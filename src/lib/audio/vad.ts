import "server-only";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseAudioFeatureCacheMax, lruMapSetLimited } from "@/lib/audio/audio-feature-cache";
import { resolveTranscriptionPython } from "@/lib/transcription/python-path";

const execFileAsync = promisify(execFile);

/**
 * Voiced/unvoiced segment as detected by the local VAD provider. Time units are seconds,
 * relative to the start of the analysed recording.
 */
export type VadSegment = { start: number; end: number };

export type VadFeatures = {
  provider: "silero" | "webrtcvad";
  sampleRateHz: number;
  durationSec: number;
  speakingSec: number;
  silenceSec: number;
  speakingRatio: number; // speakingSec / durationSec
  voicedSegments: VadSegment[];
};

export type VadResult =
  | { available: true; features: VadFeatures }
  | { available: false; reason: string };

const vadResultCache = new Map<string, VadResult>();

function scriptPath(): string {
  return path.join(process.cwd(), "scripts", "extract_vad.py");
}

async function convertToWavWithFfmpeg(inputPath: string, outWav: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outWav,
    ],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

function parseTimeoutMs(): number {
  const raw = process.env.VAD_TIMEOUT_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(raw, 10) : 45_000;
  if (!Number.isFinite(n)) return 45_000;
  return Math.min(180_000, Math.max(5_000, n));
}

function parseVadStdout(raw: string): VadResult {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return { available: false, reason: `non-json vad output: ${trimmed.slice(0, 80)}` };
  }
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(trimmed) as Record<string, unknown>;
  } catch (e) {
    return { available: false, reason: `vad json parse failed: ${(e as Error).message}` };
  }
  if (o.ok !== true) {
    const reason = typeof o.reason === "string" ? o.reason : "unknown";
    return { available: false, reason };
  }
  const provider = o.provider === "silero" || o.provider === "webrtcvad" ? o.provider : null;
  if (!provider) {
    return { available: false, reason: `unknown vad provider: ${String(o.provider)}` };
  }
  const segs = Array.isArray(o.voicedSegments)
    ? o.voicedSegments.flatMap((s) => {
        if (!s || typeof (s as Record<string, unknown>).start !== "number" || typeof (s as Record<string, unknown>).end !== "number") {
          return [];
        }
        return [{ start: (s as VadSegment).start, end: (s as VadSegment).end }];
      })
    : [];
  const num = (k: string): number => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  return {
    available: true,
    features: {
      provider,
      sampleRateHz: num("sampleRateHz") || 16000,
      durationSec: num("durationSec"),
      speakingSec: num("speakingSec"),
      silenceSec: num("silenceSec"),
      speakingRatio: num("speakingRatio"),
      voicedSegments: segs,
    },
  };
}

/**
 * Run local VAD on the given audio file. ffmpeg-converts to 16 kHz mono WAV first (matches the
 * Whisper/openSMILE input chain so all three subsystems see the same signal). Returns
 * `{ available: false, reason }` when no VAD provider is installed — callers fall back to the
 * timing-gap heuristic in {@link computeDerivedMetrics} without raising.
 *
 * Pass `opts.cacheKey` (same fingerprint as openSMILE) to reuse subprocess results inside one server process.
 */
export async function extractVadFeatures(
  audioAbsolutePath: string,
  opts?: { cacheKey?: string | null },
): Promise<VadResult> {
  const vadKey =
    opts?.cacheKey != null && opts.cacheKey !== "" ? `vad:${opts.cacheKey}` : null;
  const maxCached = parseAudioFeatureCacheMax();
  if (maxCached > 0 && vadKey) {
    const hit = vadResultCache.get(vadKey);
    if (hit) return hit;
  }

  const abs = path.resolve(audioAbsolutePath);
  if (!existsSync(abs)) {
    return { available: false, reason: `audio file not found: ${abs}` };
  }
  const script = scriptPath();
  if (!existsSync(script)) {
    return { available: false, reason: "missing extract_vad.py script" };
  }

  const ext = path.extname(abs).toLowerCase();
  let inputForPython = abs;
  let workDir: string | null = null;
  try {
    if (ext !== ".wav") {
      workDir = await mkdtemp(path.join(tmpdir(), "auravo-vad-"));
      const wavPath = path.join(workDir, "input.wav");
      try {
        await convertToWavWithFfmpeg(abs, wavPath);
        inputForPython = wavPath;
      } catch (e) {
        return { available: false, reason: `ffmpeg conversion failed: ${(e as Error).message}` };
      }
    }
    try {
      const py = resolveTranscriptionPython();
      const { stdout, stderr } = await execFileAsync(py, [script, inputForPython], {
        timeout: parseTimeoutMs(),
        maxBuffer: 16 * 1024 * 1024,
      });
      if (stderr && String(stderr).trim()) {
        console.error("[vad] python stderr:", String(stderr).trim());
      }
      const raw = String(stdout).trim();
      if (!raw) return { available: false, reason: "empty vad stdout" };
      const parsed = parseVadStdout(raw);
      if (maxCached > 0 && vadKey && parsed.available) {
        lruMapSetLimited(vadResultCache, vadKey, parsed, maxCached);
      }
      return parsed;
    } catch (e) {
      return { available: false, reason: `vad failed: ${(e as Error).message}` };
    }
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Derived metrics computed purely from VAD segments. These supersede the word-gap heuristics in
 * derive.ts when available — they are based on real silence detection rather than guessing from
 * gaps between Whisper word timestamps.
 */
export type VadDerived = {
  pauseCount: number;
  longPauseCount: number;
  longestPauseMs: number;
  totalSilenceMs: number;
  avgPauseMs: number;
  /** Continuous silence at the very start of the recording (dead-air before first word). */
  preSpeechSilenceMs: number;
};

/** Pause = silence between voiced segments ≥ MIN_PAUSE_MS. Long pause = ≥ LONG_PAUSE_MS. */
export function deriveVadStats(features: VadFeatures, minPauseMs = 350, longPauseMs = 1200): VadDerived {
  if (features.voicedSegments.length === 0) {
    return {
      pauseCount: 0,
      longPauseCount: 0,
      longestPauseMs: 0,
      totalSilenceMs: Math.round(features.silenceSec * 1000),
      avgPauseMs: 0,
      preSpeechSilenceMs: Math.round(features.durationSec * 1000),
    };
  }
  const segs = features.voicedSegments;
  let pauses = 0;
  let longPauses = 0;
  let totalPause = 0;
  let longest = 0;
  for (let i = 1; i < segs.length; i++) {
    const gapMs = (segs[i]!.start - segs[i - 1]!.end) * 1000;
    if (gapMs >= minPauseMs) {
      pauses++;
      totalPause += gapMs;
      if (gapMs > longest) longest = gapMs;
      if (gapMs >= longPauseMs) longPauses++;
    }
  }
  return {
    pauseCount: pauses,
    longPauseCount: longPauses,
    longestPauseMs: Math.round(longest),
    totalSilenceMs: Math.round(totalPause),
    avgPauseMs: pauses > 0 ? Math.round(totalPause / pauses) : 0,
    preSpeechSilenceMs: Math.round(segs[0]!.start * 1000),
  };
}
