import { describe, expect, it } from "vitest";
import {
  normalizeCollapseSegments,
  significantCollapseCount,
} from "@/lib/audio/collapse-segments";

describe("normalizeCollapseSegments", () => {
  it("drops sub-threshold dips and merges nearby ones", () => {
    const raw = [
      { start: 0, end: 0.1 },
      { start: 1, end: 1.5 },
      { start: 1.52, end: 2.0 },
      { start: 5, end: 5.8 },
    ];
    const out = normalizeCollapseSegments(raw);
    expect(out).toHaveLength(2);
    expect(out[0]!.start).toBe(1);
    expect(out[0]!.end).toBe(2);
    expect(out[1]!.start).toBe(5);
  });

  it("caps significant count for scoring", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 0.5,
    }));
    expect(significantCollapseCount(many)).toBe(20);
  });
});
