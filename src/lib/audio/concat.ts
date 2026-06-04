import "server-only";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Concatenate a sequence of audio files into a single 16 kHz mono WAV using ffmpeg's concat demuxer.
 *
 * Why concat-demuxer? It re-encodes once at the boundary so heterogeneous inputs (webm/m4a/wav) come
 * out as a single uniform stream — ideal for downstream Whisper word-timestamping, openSMILE feature
 * extraction, and VAD which all want a consistent 16 kHz mono WAV.
 *
 * @returns Path to the concatenated WAV (caller owns cleanup of the parent tmp dir).
 */
export async function concatAudioToWav(
  inputAbsolutePaths: string[],
  options: { outDir?: string; fileName?: string; gapMs?: number } = {},
): Promise<{ wavPath: string; workDir: string }> {
  if (inputAbsolutePaths.length === 0) {
    throw new Error("concatAudioToWav: no input files");
  }
  const missing = inputAbsolutePaths.filter((p) => !existsSync(p));
  if (missing.length > 0) {
    throw new Error(`concatAudioToWav: missing input file(s): ${missing.join(", ")}`);
  }
  const workDir =
    options.outDir ?? (await mkdtemp(path.join(tmpdir(), "auravo-concat-")));
  const gapMs = options.gapMs ?? 0;
  let pathsForConcat = inputAbsolutePaths;
  if (gapMs > 0 && inputAbsolutePaths.length > 1) {
    const silencePath = path.join(workDir, "gap-silence.wav");
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=16000:cl=mono",
        "-t",
        String(gapMs / 1000),
        "-c:a",
        "pcm_s16le",
        silencePath,
      ],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    );
    pathsForConcat = [];
    for (let i = 0; i < inputAbsolutePaths.length; i++) {
      pathsForConcat.push(inputAbsolutePaths[i]!);
      if (i < inputAbsolutePaths.length - 1) pathsForConcat.push(silencePath);
    }
  }
  const listPath = path.join(workDir, "inputs.txt");
  // ffmpeg concat-demuxer expects single-quoted, escaped paths.
  const listBody = pathsForConcat
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, listBody, "utf8");

  const wavPath = path.join(workDir, options.fileName ?? "concat.wav");
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wavPath,
    ],
    { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
  return { wavPath, workDir };
}
