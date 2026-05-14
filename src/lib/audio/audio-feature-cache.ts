/** Shared in-process LRU for subprocess-heavy audio pipelines (openSMILE, Silero/webrtcvad). */

import "server-only";

export function parseAudioFeatureCacheMax(): number {
  const raw =
    process.env.AURAVO_AUDIO_FEATURE_CACHE_MAX ?? process.env.OPENSMILE_CACHE_MAX ?? process.env.VAD_CACHE_MAX ?? "48";
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return 48;
  return Math.min(500, Math.max(0, n));
}

export function lruMapSetLimited<T>(map: Map<string, T>, key: string, val: T, maxEntries: number): void {
  if (maxEntries <= 0) return;
  map.delete(key);
  map.set(key, val);
  while (map.size > maxEntries) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}
