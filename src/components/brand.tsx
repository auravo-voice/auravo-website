import { cn } from "@/lib/utils";

const LOGO_SRC = "/auravo-logo.png";
const LOGO_WIDTH = 204;
const LOGO_HEIGHT = 238;

/**
 * Official Auravo mark (transparent PNG — same asset in light and dark themes).
 * Uses a plain img so sizing stays predictable in flex layouts.
 */
export function AuravoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoids Image layout quirks in nav flex
    <img
      src={LOGO_SRC}
      alt="Auravo"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      decoding="async"
      fetchPriority="high"
      className={cn(
        "block h-9 w-auto min-h-9 shrink-0 object-contain object-left",
        className,
      )}
    />
  );
}

export function VocaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary",
        className,
      )}
    >
      Voca · AI coach
    </span>
  );
}
