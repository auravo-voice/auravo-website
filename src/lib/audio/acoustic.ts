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
 * Curated openSMILE eGeMAPSv02 features used by the scoring layer. All units are normalised so the
 * scorer never has to remember whether eGeMAPS shipped a particular metric as a percentage, semitone,
 * dB, or ratio. `null` means openSMILE was unable to estimate the feature reliably (e.g. silence-only
 * audio for pitch) — scorers must treat null as "unknown" and degrade gracefully.
 */
export type AcousticFeatures = {
  featureSet: "eGeMAPSv02";
  /** Mean fundamental frequency in Hz. Higher values typically indicate a smaller speaker or rising pitch. */
  pitchMeanHz: number | null;
  /** Stddev of F0 in semitones (eGeMAPS normalises pitch on a semitone scale). Drives the "monotone" check. */
  pitchStddevSemitones: number | null;
  /** F0 percentile range in semitones (P98 - P2). Wide range = expressive pitch use. */
  pitchRangeSemitones: number | null;
  /** Mean loudness (Zwicker; eGeMAPS units, comparable across utterances). */
  loudnessMean: number | null;
  /** Loudness stddev (normalised). High = uneven volume → drops "loudness stability." */
  loudnessStddev: number | null;
  /** Loudness percentile range. Used as a clarity signal when combined with HNR. */
  loudnessRange: number | null;
  /** Mean harmonics-to-noise ratio in dB. Higher = cleaner voice quality (drives clarity). */
  hnrMeanDb: number | null;
  /** Mean jitter percentage. Higher = less steady pitch period → "shaky voice." */
  jitterLocalPct: number | null;
  /** Mean shimmer in dB. Higher = uneven amplitude → also feeds the clarity/confidence signal. */
  shimmerLocaldB: number | null;
  /** Fraction of frames classified voiced. <0.4 typically means lots of silence; >0.9 means continuous speech. */
  voicedRatio: number | null;
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
  return path.join(process.cwd(), "scripts", "extract_opensmile.py");
}

async function convertToWavWithFfmpeg(inputPath: string, outWav: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outWav],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

function parseTimeoutMs(): number {
  const raw = process.env.OPENSMILE_TIMEOUT_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(raw, 10) : 60_000;
  if (!Number.isFinite(n)) return 60_000;
  return Math.min(180_000, Math.max(5_000, n));
}

const openSmileResultCache = new Map<string, AcousticResult>();

function parseAcousticStdout(raw: string): AcousticResult {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return { available: false, reason: `non-json opensmile output: ${trimmed.slice(0, 80)}` };
  }
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(trimmed) as Record<string, unknown>;
  } catch (e) {
    return { available: false, reason: `opensmile json parse failed: ${(e as Error).message}` };
  }
  if (o.ok !== true) {
    const reason = typeof o.reason === "string" ? o.reason : "unknown";
    return { available: false, reason };
  }
  const num = (k: string): number | null => {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };
  return {
    available: true,
    features: {
      featureSet: "eGeMAPSv02",
      pitchMeanHz: num("pitchMeanHz"),
      pitchStddevSemitones: num("pitchStddevSemitones"),
      pitchRangeSemitones: num("pitchRangeSemitones"),
      loudnessMean: num("loudnessMean"),
      loudnessStddev: num("loudnessStddev"),
      loudnessRange: num("loudnessRange"),
      hnrMeanDb: num("hnrMeanDb"),
      jitterLocalPct: num("jitterLocalPct"),
      shimmerLocaldB: num("shimmerLocaldB"),
      voicedRatio: num("voicedRatio"),
    },
  };
}

/**
 * Extract eGeMAPSv02 features for a single recording. Returns `{ available: false, reason }` instead
 * of throwing when openSMILE is not installed — the scorer treats these as "unknown" and lowers the
 * weight of voice-quality dimensions accordingly.
 *
 * Always converts to 16 kHz mono WAV with ffmpeg first (matches the Whisper input pipeline so we are
 * scoring the same signal the transcriber heard).
 *
 * @param opts.cacheKey — optional stable fingerprint string (typically from {@link fingerprintAudioInputs}) so identical
 *   source recordings hit an in-memory LRU cache and skip rerunning ffmpeg + opensmile subprocess.
 */
export async function extractAcousticFeatures(
  audioAbsolutePath: string,
  opts?: { cacheKey?: string | null },
): Promise<AcousticResult> {
  const smileKey =
    opts?.cacheKey != null && opts.cacheKey !== ""
      ? `opensmile:${opts.cacheKey}`
      : null;
  const maxCached = parseAudioFeatureCacheMax();
  if (maxCached > 0 && smileKey) {
    const hit = openSmileResultCache.get(smileKey);
    if (hit) return hit;
  }

  const abs = path.resolve(audioAbsolutePath);
  if (!existsSync(abs)) {
    return { available: false, reason: `audio file not found: ${abs}` };
  }
  const script = scriptPath();
  if (!existsSync(script)) {
    return { available: false, reason: `missing extract_opensmile.py script` };
  }

  const ext = path.extname(abs).toLowerCase();
  let inputForPython = abs;
  let workDir: string | null = null;
  try {
    if (FFMPEG_CONVERT_EXTENSIONS.has(ext) || ext !== ".wav") {
      workDir = await mkdtemp(path.join(tmpdir(), "auravo-opensmile-"));
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
        console.error("[opensmile] python stderr:", String(stderr).trim());
      }
      const raw = String(stdout).trim();
      if (!raw) {
        return { available: false, reason: "empty opensmile stdout" };
      }
      const parsed = parseAcousticStdout(raw);
      if (maxCached > 0 && smileKey && parsed.available) {
        lruMapSetLimited(openSmileResultCache, smileKey, parsed, maxCached);
      }
      return parsed;
    } catch (e) {
      return {
        available: false,
        reason: `opensmile failed: ${(e as Error).message}`,
      };
    }
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
