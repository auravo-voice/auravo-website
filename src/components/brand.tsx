import { cn } from "@/lib/utils";

const LOGO_ICON_SRC = "/talkinglabs-logo.png";
const LOGO_FULL_SRC = "/talkinglabs-logo-full.png";

/** Talking Labs icon mark (TL speech bubbles). */
export function TalkingLabsLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      src={LOGO_ICON_SRC}
      alt="Talking Labs"
      width={600}
      height={600}
      decoding="async"
      fetchPriority="high"
      className={cn(
        "block h-14 w-auto min-h-14 shrink-0 object-contain object-left",
        className,
      )}
    />
  );
}

/** Talking Labs wordmark (icon + Talking / Labs). */
export function TalkingLabsLogoFull({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      src={LOGO_FULL_SRC}
      alt="Talking Labs"
      width={600}
      height={600}
      decoding="async"
      fetchPriority="high"
      className={cn(
        "block h-20 w-auto shrink-0 object-contain object-left sm:h-24",
        className,
      )}
    />
  );
}

/** Compact horizontal lockup for sidebar — icon asset + type (tighter than square wordmark PNG). */
export function SidebarBrand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2.5" : "gap-3", className)}>
      <TalkingLabsLogo className={cn("w-auto shrink-0", compact ? "h-12" : "h-[3.5rem]")} />
      <div className={cn("flex min-w-0 flex-col leading-none", compact ? "gap-0.5" : "gap-1")}>
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.02em] text-primary",
            compact ? "text-[15px]" : "text-[1.0625rem]",
          )}
        >
          Talking
        </span>
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.02em] text-accent",
            compact ? "text-[15px]" : "text-[1.0625rem]",
          )}
        >
          Labs
        </span>
      </div>
    </div>
  );
}

/** @deprecated Use {@link TalkingLabsLogo}. */
export const AuravoMark = TalkingLabsLogo;

export function BrandBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border border-primary/15 bg-primary-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary",
        className,
      )}
    >
      Voice coaching
    </span>
  );
}

/** @deprecated Use {@link BrandBadge}. */
export const VocaBadge = BrandBadge;
