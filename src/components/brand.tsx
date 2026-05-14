import { cn } from "@/lib/utils";

const LOGO_SRC = "/auravo-logo.png";
const LOGO_WIDTH = 456;
const LOGO_HEIGHT = 244;

/**
 * Official auravo lockup (waveform + wordmark).
 * Uses a plain img so sizing stays predictable in flex layouts (Next/Image wrapper
 * could collapse width in some chrome breakpoints).
 */
export function AuravoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoids Image layout quirks in nav flex
    <img
      src={LOGO_SRC}
      alt="auravo"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      decoding="async"
      fetchPriority="high"
      className={cn(
        "block h-9 w-auto min-w-[4.5rem] max-w-[min(240px,72vw)] shrink-0 object-contain object-left",
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
