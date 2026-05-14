import { cn } from "@/lib/utils";

const heights = [32, 48, 40, 56, 36, 52, 44, 60, 38, 50, 42, 55];

export function VoiceWaveform({
  className,
  bars = 12,
}: {
  className?: string;
  bars?: number;
}) {
  const slice = heights.slice(0, bars);
  return (
    <div className={cn("flex h-14 items-end justify-center gap-1", className)} aria-hidden>
      {slice.map((h, i) => (
        <span
          key={i}
          className="voice-bar w-1 rounded-full bg-gradient-to-t from-primary via-primary to-accent"
          style={{
            height: `${h}%`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
