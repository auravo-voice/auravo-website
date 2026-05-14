import "server-only";

import path from "node:path";
import { stat } from "node:fs/promises";

/**
 * Stable key for caching expensive subprocess features (openSMILE, VAD). Same concatenation of source
 * files reused in one dev session misses the ffmpeg + Python cold path on the second finalize.
 *
 * Uses (resolved path + size + mtime ms); if anything is unreadable returns `null` and callers skip caching.
 */
export async function fingerprintAudioInputs(absPaths: string[]): Promise<string | null> {
  if (absPaths.length === 0) return null;
  const parts: string[] = [];
  try {
    for (const p of absPaths) {
      const abs = path.resolve(p);
      const st = await stat(abs);
      parts.push(`${abs}:${st.size}:${Math.floor(st.mtimeMs)}`);
    }
    return parts.join("|");
  } catch {
    return null;
  }
}
