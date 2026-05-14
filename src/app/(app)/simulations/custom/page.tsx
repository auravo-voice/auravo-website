import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomScenarioFlow } from "./custom-scenario-flow";

export const dynamic = "force-dynamic";

export default function CustomScenarioPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/simulations">
            <ArrowLeft className="size-3.5" />
            Library
          </Link>
        </Button>
      </div>
      <header>
        <p className="text-sm font-medium text-muted-foreground">Custom scenario</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Describe it; we will play it.</h1>
        <p className="mt-2 text-muted-foreground">
          Type a sentence or two about the conversation you want to practise. The local coach drafts a persona,
          opener, and follow-up themes; you can edit before starting.
        </p>
      </header>
      <CustomScenarioFlow />
    </div>
  );
}
