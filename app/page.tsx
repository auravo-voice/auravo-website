import Link from "next/link";
import { AuravoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,102,0,0.12),transparent)]" />
      <div className="relative z-10 flex max-w-lg flex-col items-center">
        <AuravoMark className="h-12 max-w-[min(280px,88vw)] sm:h-14" />
        <h1 className="mt-10 font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          Speak with clarity in the moments that matter.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Auravo coaches how you sound—pace, structure, and presence—so interviews, updates, and live conversations feel
          practiced, not improvised.
        </p>
        <Button asChild size="lg" className="mt-10 min-w-[12rem] shadow-primary/25" variant="glow">
          <Link href="/dashboard">Open Auravo</Link>
        </Button>
        {/* Quick Analysis demo — disabled until re-enabled
        <Button asChild size="lg" variant="outline" className="mt-3 min-w-[12rem]">
          <Link href="/quick-analysis">Quick Analysis</Link>
        </Button>
        */}
        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/onboarding" className="font-medium text-primary underline-offset-4 hover:underline">
            Set your goal
          </Link>{" "}
          or{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            sign in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
