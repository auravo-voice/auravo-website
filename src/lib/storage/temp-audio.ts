import "server-only";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TMP_ROOT = path.join(os.tmpdir(), "auravo-audio");

export function getTempAudioRoot(): string {
  return TMP_ROOT;
}

/** Write uploaded audio to `/tmp` for serverless-safe processing (Whisper, ffmpeg). */
export async function writeTempAudioFile(
  id: string,
  blob: Blob,
  ext: "webm" | "m4a" = "webm",
): Promise<{ absolutePath: string; relativePath: string }> {
  await fs.mkdir(TMP_ROOT, { recursive: true });
  const filename = `${id}.${ext}`;
  const absolutePath = path.join(TMP_ROOT, filename);
  const buf = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(absolutePath, buf);
  return { absolutePath, relativePath: `tmp/${filename}` };
}

export async function writeTempAudioFromBuffer(
  id: string,
  buf: Buffer,
  ext: "webm" | "m4a" = "webm",
): Promise<{ absolutePath: string; relativePath: string }> {
  await fs.mkdir(TMP_ROOT, { recursive: true });
  const filename = `${id}.${ext}`;
  const absolutePath = path.join(TMP_ROOT, filename);
  await fs.writeFile(absolutePath, buf);
  return { absolutePath, relativePath: `tmp/${filename}` };
}
