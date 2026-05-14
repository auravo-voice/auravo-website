import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getScenarioById } from "@/lib/simulations/library";
import { Button } from "@/components/ui/button";
import { SimulationRunner } from "../simulation-runner";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ scenarioId: string }> };

export default async function ScenarioRunnerPage({ params }: PageProps) {
  const { scenarioId } = await params;
  const scenario = getScenarioById(scenarioId);
  if (!scenario) notFound();

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
      <SimulationRunner
        init={{
          kind: "static",
          scenarioId: scenario.id,
          title: scenario.title,
          description: scenario.description,
          personaName: scenario.personaName,
          topics: scenario.topics,
          recommendedMinutes: scenario.recommendedMinutes,
        }}
      />
    </div>
  );
}
