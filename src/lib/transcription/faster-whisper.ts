import "server-only";
import { existsSync } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TranscriptionAdapter, TranscriptionResult } from "@/lib/transcription/types";
import type { AsrWordHint } from "@/lib/assessment/baseline-analysis-types";
import { resolveTranscriptionPython } from "@/lib/transcription/python-path";

const execFileAsync = promisify(execFile);

const FFMPEG_CONVERT_EXTENSIONS = new Set([".webm", ".m4a", ".mp4", ".oga", ".ogg", ".opus"]);

function parseTimeoutMs(): number {
  const raw = process.env.FASTER_WHISPER_TIMEOUT_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(raw, 10) : 120_000;
  if (!Number.isFinite(n)) return 120_000;
  return Math.min(600_000, Math.max(5_000, n));
}

function homebrewPrefix(): string {
  const p = process.env.HOMEBREW_PREFIX?.trim();
  if (p) return p;
  return process.arch === "arm64" ? "/opt/homebrew" : "/usr/local";
}

/** Homebrew Python on macOS can resolve `pyexpat` against `/usr/lib/libexpat`; prepend keg-only expat first. */
function darwinHomebrewExpatLibDir(): string | null {
  if (process.platform !== "darwin") return null;
  if (process.env.FASTER_WHISPER_DISABLE_DYLD_EXPAT === "1") return null;
  const dir = path.join(homebrewPrefix(), "opt", "expat", "lib");
  return existsSync(dir) ? dir : null;
}

function envForPythonChild(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const expatLib = darwinHomebrewExpatLibDir();
  if (!expatLib) return base;
  const prev = base.DYLD_LIBRARY_PATH?.trim();
  return { ...base, DYLD_LIBRARY_PATH: prev ? `${expatLib}:${prev}` : expatLib };
}

function parseTranscriptionStdout(raw: string): TranscriptionResult {
  const t = raw.trim();
  if (!t.startsWith("{")) {
    return { text: t };
  }
  type RawOut = {
    text?: string;
    modelName?: string;
    durationSec?: number;
    language?: string | null;
    segments?: { start?: number; end?: number; text?: string }[];
    words?: { word?: string; start?: number; end?: number; probability?: number }[];
    lowConfidence?: { token?: string; probability?: number }[];
  };
  let o: RawOut;
  try {
    o = JSON.parse(t) as RawOut;
  } catch {
    return { text: t };
  }
  const text = typeof o.text === "string" ? o.text : "";

  const hints: AsrWordHint[] = [];
  if (Array.isArray(o.lowConfidence)) {
    for (const row of o.lowConfidence) {
      if (row && typeof row.token === "string" && typeof row.probability === "number") {
        hints.push({ token: row.token, probability: row.probability });
      }
    }
  }

  const wordTimings = Array.isArray(o.words)
    ? o.words.flatMap((w) => {
        if (
          !w ||
          typeof w.word !== "string" ||
          typeof w.start !== "number" ||
          typeof w.end !== "number" ||
          typeof w.probability !== "number"
        ) {
          return [];
        }
        return [{ word: w.word, start: w.start, end: w.end, probability: w.probability }];
      })
    : undefined;

  const segments = Array.isArray(o.segments)
    ? o.segments.flatMap((s) => {
        if (!s || typeof s.start !== "number" || typeof s.end !== "number" || typeof s.text !== "string") {
          return [];
        }
        return [{ start: s.start, end: s.end, text: s.text }];
      })
    : undefined;

  return {
    text,
    asrWordHints: hints.length ? hints : undefined,
    wordTimings: wordTimings && wordTimings.length ? wordTimings : undefined,
    segments: segments && segments.length ? segments : undefined,
    durationSec: typeof o.durationSec === "number" && o.durationSec > 0 ? o.durationSec : undefined,
    modelName: typeof o.modelName === "string" ? o.modelName : undefined,
    language: typeof o.language === "string" ? o.language : undefined,
  };
}

function scriptPath(): string {
  return path.join(process.cwd(), "scripts", "transcribe_faster_whisper.py");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function convertToWavWithFfmpeg(inputPath: string, outWav: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outWav],
    { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

/**
 * Runs `scripts/transcribe_faster_whisper.py` via Python. May convert .webm (etc.) to WAV with ffmpeg first.
 * Throws on failure — callers that need resilience should wrap with a fallback adapter.
 */
export class FasterWhisperTranscriptionAdapter implements TranscriptionAdapter {
  readonly name = "faster-whisper";

  async transcribe(audioAbsolutePath: string): Promise<TranscriptionResult> {
    const abs = path.resolve(audioAbsolutePath);
    if (!(await fileExists(abs))) {
      throw new Error(`FasterWhisperTranscriptionAdapter: file not found: ${abs}`);
    }

    const script = scriptPath();
    if (!(await fileExists(script))) {
      throw new Error(`FasterWhisperTranscriptionAdapter: missing script: ${script}`);
    }

    const ext = path.extname(abs).toLowerCase();
    let inputForPython = abs;
    let workDir: string | null = null;

    if (FFMPEG_CONVERT_EXTENSIONS.has(ext)) {
      workDir = await mkdtemp(path.join(tmpdir(), "auravo-fw-"));
      const wavPath = path.join(workDir, "input.wav");
      try {
        await convertToWavWithFfmpeg(abs, wavPath);
        inputForPython = wavPath;
      } catch (e) {
        console.error(
          "[faster-whisper] ffmpeg conversion failed; attempting native path for faster-whisper:",
          e,
        );
        inputForPython = abs;
      }
    }

    const py = resolveTranscriptionPython();
    const timeoutMs = parseTimeoutMs();
    const model = (process.env.FASTER_WHISPER_MODEL ?? "base").trim() || "base";

    try {
      const { stdout, stderr } = await execFileAsync(
        py,
        [script, inputForPython],
        {
          timeout: timeoutMs,
          maxBuffer: 32 * 1024 * 1024,
          env: envForPythonChild({
            ...process.env,
            FASTER_WHISPER_MODEL: model,
          }),
        },
      );
      if (stderr != null && String(stderr).trim()) {
        console.error("[faster-whisper] python stderr:", String(stderr).trim());
      }
      const raw = String(stdout).trim();
      if (!raw) {
        throw new Error("FasterWhisperTranscriptionAdapter: empty transcript from stdout");
      }
      return parseTranscriptionStdout(raw);
    } finally {
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}
