"use client";

import { SkillRadar } from "@/components/skill-radar";
import { scoresToRadarDimensions } from "@/lib/assessment/dimensions-from-scores";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { cn } from "@/lib/utils";

export function RadarSnapshot({
  scores,
  className,
  caption,
}: {
  scores: SixDimensionScores;
  className?: string;
  caption?: string;
}) {
  const dimensions = scoresToRadarDimensions(scores);
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <SkillRadar dimensions={dimensions} className="mx-auto w-full max-w-[300px] opacity-[0.97]" />
      {caption ? <p className="max-w-md text-center text-sm text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
