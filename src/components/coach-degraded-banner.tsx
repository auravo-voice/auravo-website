import { AlertTriangle } from "lucide-react";

import { warningBannerLgClass } from "@/lib/ui/warning-styles";

export function CoachDegradedBanner({ message }: { message: string }) {
  return (
    <div role="status" className={`flex gap-3 px-4 py-3 ${warningBannerLgClass}`}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
