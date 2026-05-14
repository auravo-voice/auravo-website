import { SCENARIO_LIBRARY } from "@/lib/simulations/library";
import { SimulationsBrowser } from "./simulations-browser";

export const dynamic = "force-static";

export default function SimulationsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Simulations</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Scenario library</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {SCENARIO_LIBRARY.length} curated, prebuilt scenarios across seven categories. Each runs as a real
          turn-by-turn conversation with a local AI partner — pick a difficulty, record your replies, and end
          whenever it feels real enough.
        </p>
      </header>
      <SimulationsBrowser scenarios={SCENARIO_LIBRARY} />
    </div>
  );
}
