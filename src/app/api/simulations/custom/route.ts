import { NextResponse } from "next/server";
import { generateCustomScenario } from "@/lib/simulations/turn-coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Free-text → single scenario via Ollama. Used by `/simulations/custom` to populate the runner. */
export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const description = typeof obj.description === "string" ? obj.description.trim() : "";
  if (description.length < 8) {
    return NextResponse.json(
      { error: "Describe the scenario in at least a sentence (8+ characters)." },
      { status: 400 },
    );
  }
  const { scenario, warning } = await generateCustomScenario({ description });
  return NextResponse.json({ scenario, coachWarning: warning });
}
