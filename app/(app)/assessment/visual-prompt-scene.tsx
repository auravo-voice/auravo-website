import * as React from "react";

/**
 * Fixed illustration for the visual-description segment of the initial assessment. Renders as an SVG (color-blind
 * friendly palette, large shapes) so learners on dark/light themes both see crisp contrast. The scene is intentionally
 * detailed enough to support ~45 seconds of description without being overwhelming.
 */
export function VisualPromptScene({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="A busy coffee shop scene: a barista behind a counter, two customers, a window showing a city street with a bicycle and a tree."
      viewBox="0 0 320 240"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="0" y="0" width="320" height="240" rx="14" fill="hsl(216 28% 14%)" />
      <rect x="14" y="14" width="292" height="212" rx="10" fill="hsl(216 28% 18%)" />

      {/* Window */}
      <rect x="32" y="32" width="120" height="84" rx="6" fill="hsl(214 80% 70%)" />
      <rect x="32" y="32" width="120" height="84" rx="6" fill="url(#sunGrad)" opacity="0.6" />
      <defs>
        <linearGradient id="sunGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(48 100% 80%)" />
          <stop offset="100%" stopColor="hsl(214 80% 70%)" />
        </linearGradient>
      </defs>

      {/* Skyline silhouette */}
      <g fill="hsl(220 20% 30%)">
        <rect x="38" y="74" width="14" height="42" />
        <rect x="56" y="64" width="18" height="52" />
        <rect x="78" y="78" width="10" height="38" />
        <rect x="92" y="60" width="22" height="56" />
        <rect x="118" y="80" width="14" height="36" />
        <rect x="136" y="70" width="14" height="46" />
      </g>

      {/* Street: bicycle */}
      <g stroke="hsl(40 90% 70%)" strokeWidth="2.5" fill="none">
        <circle cx="64" cy="110" r="7" />
        <circle cx="92" cy="110" r="7" />
        <line x1="64" y1="110" x2="78" y2="92" />
        <line x1="92" y1="110" x2="78" y2="92" />
        <line x1="78" y1="92" x2="92" y2="92" />
      </g>

      {/* Tree */}
      <ellipse cx="138" cy="100" rx="10" ry="14" fill="hsl(140 50% 55%)" />
      <rect x="135" y="110" width="6" height="10" fill="hsl(30 40% 40%)" />

      {/* Counter */}
      <rect x="32" y="160" width="256" height="42" rx="4" fill="hsl(28 40% 38%)" />
      <rect x="32" y="160" width="256" height="6" rx="2" fill="hsl(28 30% 28%)" />

      {/* Espresso machine */}
      <rect x="48" y="138" width="42" height="22" rx="3" fill="hsl(0 0% 80%)" />
      <rect x="56" y="142" width="8" height="6" fill="hsl(0 0% 30%)" />
      <rect x="70" y="142" width="8" height="6" fill="hsl(0 0% 30%)" />
      <rect x="58" y="156" width="4" height="6" fill="hsl(0 0% 30%)" />
      <rect x="72" y="156" width="4" height="6" fill="hsl(0 0% 30%)" />

      {/* Barista */}
      <circle cx="120" cy="142" r="8" fill="hsl(28 60% 65%)" />
      <rect x="112" y="150" width="16" height="14" rx="3" fill="hsl(180 50% 50%)" />

      {/* Customer 1 */}
      <g>
        <circle cx="210" cy="146" r="7" fill="hsl(28 60% 55%)" />
        <rect x="202" y="154" width="16" height="14" rx="3" fill="hsl(260 50% 60%)" />
      </g>

      {/* Customer 2 with a coffee cup */}
      <g>
        <circle cx="240" cy="148" r="7" fill="hsl(28 60% 75%)" />
        <rect x="232" y="156" width="16" height="14" rx="3" fill="hsl(340 60% 60%)" />
      </g>

      {/* Coffee cup on the counter */}
      <g>
        <rect x="200" y="170" width="14" height="12" rx="2" fill="hsl(0 0% 95%)" />
        <path d="M214 173 q4 0 4 4 t-4 4" fill="none" stroke="hsl(0 0% 95%)" strokeWidth="2" />
      </g>

      {/* Floor line */}
      <rect x="14" y="208" width="292" height="18" rx="2" fill="hsl(28 25% 22%)" />

      {/* Plant */}
      <g>
        <rect x="172" y="138" width="14" height="6" rx="1" fill="hsl(28 30% 28%)" />
        <ellipse cx="179" cy="132" rx="9" ry="7" fill="hsl(140 50% 50%)" />
      </g>
    </svg>
  );
}
