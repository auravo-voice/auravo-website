import { AlertTriangle } from "lucide-react";

export function CoachDegradedBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
