/** Minimum sustained dip length to count as a voice-energy collapse (filters frame-level noise). */
export const COLLAPSE_MIN_DURATION_SEC = 0.35;

/** Merge collapses separated by a gap shorter than this (same breath / mic wobble). */
export const COLLAPSE_MERGE_GAP_SEC = 0.12;

export type CollapseSegment = { start: number; end: number };

export function normalizeCollapseSegments(segments: CollapseSegment[]): CollapseSegment[] {
  const filtered = segments
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .filter((s) => s.end - s.start >= COLLAPSE_MIN_DURATION_SEC)
    .sort((a, b) => a.start - b.start);

  const merged: CollapseSegment[] = [];
  for (const seg of filtered) {
    const last = merged[merged.length - 1];
    if (last && seg.start - last.end <= COLLAPSE_MERGE_GAP_SEC) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ start: seg.start, end: seg.end });
    }
  }
  return merged;
}

/** Human-facing count for scoring penalties (already normalized). */
export function significantCollapseCount(segments: CollapseSegment[]): number {
  return normalizeCollapseSegments(segments).length;
}
