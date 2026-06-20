import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

export function AnalysisSectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}
