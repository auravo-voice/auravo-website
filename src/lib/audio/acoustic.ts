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

/** Time-aligned acoustic features from Parselmouth + librosa (replaces openSMILE). */
export type AcousticFeatures = {
  pitch: {
    mean: number;
    range: number;
    isMonotone: boolean;
    timeline: { t: number; hz: number }[];
  };
  intensity: {
    mean: number;
    collapseSegments: { start: number; end: number }[];
  };
  rhythm: {
    tempoVariation: number;
    clarityScore: number;
  };
};

export type AcousticUnavailable = {
  available: false;
  reason: string;
};

export type AcousticAvailable = {
  available: true;
  features: AcousticFeatures;
};

export type AcousticResult = AcousticAvailable | AcousticUnavailable;

const FFMPEG_CONVERT_EXTENSIONS = new Set([".webm", ".m4a", ".mp4", ".oga", ".ogg", ".opus", ".flac", ".aac"]);

function scriptPath(): string {
  return path.join(process.cwd(), "scripts", "extract_acoustic.py");
}

async function convertToWavWithFfmpeg(inputPath: string, outWav: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outWav],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

function parseTimeoutMs(): number {
  const raw = process.env.ACOUSTIC_TIMEOUT_MS ?? process.env.OPENSMILE_TIMEOUT_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(raw, 10) : 90_000;
  if (!Number.isFinite(n)) return 90_000;
  return Math.min(180_000, Math.max(5_000, n));
}

const acousticResultCache = new Map<string, AcousticResult>();

function parseAcousticStdout(raw: string): AcousticResult {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return { available: false, reason: `non-json acoustic output: ${trimmed.slice(0, 80)}` };
  }
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(trimmed) as Record<string, unknown>;
  } catch (e) {
    return { available: false, reason: `acoustic json parse failed: ${(e as Error).message}` };
  }
  if (o.ok === false) {
    const reason = typeof o.reason === "string" ? o.reason : "unknown";
    return { available: false, reason };
  }

  const pitchRaw = o.pitch;
  const intensityRaw = o.intensity;
  const rhythmRaw = o.rhythm;
  if (!pitchRaw || typeof pitchRaw !== "object" || !intensityRaw || typeof intensityRaw !== "object" || !rhythmRaw || typeof rhythmRaw !== "object") {
    return { available: false, reason: "acoustic payload missing pitch/intensity/rhythm" };
  }

  const pitch = pitchRaw as Record<string, unknown>;
  const intensity = intensityRaw as Record<string, unknown>;
  const rhythm = rhythmRaw as Record<string, unknown>;

  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const collapseSegments: { start: number; end: number }[] = [];
  const segs = intensity.collapse_segments ?? intensity.collapseSegments;
  if (Array.isArray(segs)) {
    for (const s of segs) {
      if (!s || typeof s !== "object") continue;
      const row = s as Record<string, unknown>;
      collapseSegments.push({ start: num(row.start), end: num(row.end) });
    }
  }

  const timeline: { t: number; hz: number }[] = [];
  const tl = pitch.timeline;
  if (Array.isArray(tl)) {
    for (const pt of tl) {
      if (!pt || typeof pt !== "object") continue;
      const row = pt as Record<string, unknown>;
      timeline.push({ t: num(row.t), hz: num(row.hz) });
    }
  }

  return {
    available: true,
    features: {
      pitch: {
        mean: num(pitch.mean),
        range: num(pitch.range),
        isMonotone: pitch.is_monotone === true || pitch.isMonotone === true,
        timeline,
      },
      intensity: {
        mean: num(intensity.mean),
        collapseSegments,
      },
      rhythm: {
        tempoVariation: num(rhythm.tempo_variation ?? rhythm.tempoVariation),
        clarityScore: num(rhythm.clarity_score ?? rhythm.clarityScore),
      },
    },
  };
}

/**
 * Extract Parselmouth + librosa features for a single recording. Degrades gracefully when Python deps
 * are missing — the scorer treats unavailable acoustic data as unknown.
 */
export async function extractAcousticFeatures(
  audioAbsolutePath: string,
  opts?: { cacheKey?: string | null },
): Promise<AcousticResult> {
  const cacheKey =
    opts?.cacheKey != null && opts.cacheKey !== "" ? `acoustic:${opts.cacheKey}` : null;
  const maxCached = parseAudioFeatureCacheMax();
  if (maxCached > 0 && cacheKey) {
    const hit = acousticResultCache.get(cacheKey);
    if (hit) return hit;
  }

  const abs = path.resolve(audioAbsolutePath);
  if (!existsSync(abs)) {
    return { available: false, reason: `audio file not found: ${abs}` };
  }
  const script = scriptPath();
  if (!existsSync(script)) {
    return { available: false, reason: "missing extract_acoustic.py script" };
  }

  const ext = path.extname(abs).toLowerCase();
  let inputForPython = abs;
  let workDir: string | null = null;
  try {
    if (FFMPEG_CONVERT_EXTENSIONS.has(ext) || ext !== ".wav") {
      workDir = await mkdtemp(path.join(tmpdir(), "auravo-acoustic-"));
      const wavPath = path.join(workDir, "input.wav");
      try {
        await convertToWavWithFfmpeg(abs, wavPath);
        inputForPython = wavPath;
      } catch (e) {
        return {
          available: false,
          reason: `ffmpeg conversion failed: ${(e as Error).message}`,
        };
      }
    }
    try {
      const py = resolveTranscriptionPython();
      const { stdout, stderr } = await execFileAsync(py, [script, inputForPython], {
        timeout: parseTimeoutMs(),
        maxBuffer: 16 * 1024 * 1024,
      });
      if (stderr && String(stderr).trim()) {
        console.error("[acoustic] python stderr:", String(stderr).trim());
      }
      const raw = String(stdout).trim();
      if (!raw) {
        return { available: false, reason: "empty acoustic stdout" };
      }
      const parsed = parseAcousticStdout(raw);
      if (maxCached > 0 && cacheKey && parsed.available) {
        lruMapSetLimited(acousticResultCache, cacheKey, parsed, maxCached);
      }
      return parsed;
    } catch (e) {
      return {
        available: false,
        reason: `acoustic extraction failed: ${(e as Error).message}`,
      };
    }
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
