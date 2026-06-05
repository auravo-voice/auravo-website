"use client";

import { useId, useMemo } from "react";
import type { RadarDimension } from "@/lib/coach/schemas";
import { cn } from "@/lib/utils";

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function SkillRadar({
  className,
  dimensions,
}: {
  className?: string;
  dimensions: readonly RadarDimension[];
}) {
  const uid = useId().replace(/:/g, "");
  const fillId = `radarFill-${uid}`;
  const strokeId = `radarStroke-${uid}`;

  const scores = useMemo(() => dimensions.map((d) => d.score), [dimensions]);
  const labels = useMemo(() => dimensions.map((d) => d.label), [dimensions]);
  const n = scores.length || 6;
  const cx = 130;
  const cy = 130;
  const rings = [25, 50, 75, 100];
  const maxR = 88;
  const points = scores.map((score, i) => {
    const angle = -90 + (360 / n) * i;
    const r = (Math.min(100, Math.max(0, score)) / 100) * maxR;
    return polarPoint(cx, cy, r, angle);
  });
  const path =
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 260 260"
        className="size-full max-w-xs text-foreground drop-shadow-[0_0_40px_rgba(255,102,0,0.2)] sm:max-w-sm"
      >
        <defs>
          <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff6600" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#cc0000" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={strokeId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff6600" />
            <stop offset="100%" stopColor="#cc0000" />
          </linearGradient>
        </defs>
        {rings.map((pct) => (
          <polygon
            key={pct}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
            points={Array.from({ length: n }, (_, i) => {
              const angle = -90 + (360 / n) * i;
              const p = polarPoint(cx, cy, (pct / 100) * maxR, angle);
              return `${p.x},${p.y}`;
            }).join(" ")}
          />
        ))}
        {Array.from({ length: n }, (_, i) => {
          const angle = -90 + (360 / n) * i;
          const p = polarPoint(cx, cy, maxR, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth={1}
            />
          );
        })}
        <path
          d={path}
          fill={`url(#${fillId})`}
          stroke={`url(#${strokeId})`}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {points.map((_, i) => {
          const score = Math.round(scores[i] ?? 0);
          const angle = -90 + (360 / n) * i;
          const spokeR = (score / 100) * maxR;
          const badgeR = Math.min(Math.max(spokeR + 10, 22), maxR - 6);
          const badge = polarPoint(cx, cy, badgeR, angle);
          return (
            <g key={`score-badge-${i}`}>
              <circle
                cx={badge.x}
                cy={badge.y}
                r={13}
                className="fill-background/90 stroke-primary/40"
                strokeWidth={1}
              />
              <text
                x={badge.x}
                y={badge.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="currentColor"
                className="text-[10px] font-semibold tabular-nums"
              >
                {score}%
              </text>
            </g>
          );
        })}
        {labels.map((label, i) => {
          const angle = -90 + (360 / n) * i;
          const p = polarPoint(cx, cy, maxR + 26, angle);
          return (
            <text
              key={`${label}-${i}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              opacity={0.55}
              className="text-[9px] font-medium uppercase tracking-wide"
            >
              {label.split(" ")[0]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
