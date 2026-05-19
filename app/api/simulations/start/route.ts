import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createPracticeSession } from "@/db/queries/practice-persist";
import { ensureUserProfile } from "@/db/queries/user";
import { insertSimulationTurn } from "@/db/queries/simulations";
import { getScenarioById, isDifficulty } from "@/lib/simulations/library";
import { generateCustomScenario } from "@/lib/simulations/turn-coach";
import { describeSimulationHeader } from "@/lib/simulations/persona";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a `practice_session(kind="simulation_draft")` row and the AI's opener turn. The draft kind keeps abandoned
 * runs out of streak counts and the progress timeline; finalize flips it to "simulation".
 *
 * Body shape:
 *  - Static scenario:  { scenarioId: string, difficulty: "easy"|"medium"|"hard" }
 *  - Custom scenario:  { custom: { title, description, personaName, personaSummary, opener, topics }, difficulty }
 */
export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;
  const userId = auth;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const difficultyRaw = obj.difficulty;
  if (!isDifficulty(difficultyRaw)) {
    return NextResponse.json({ error: "Invalid difficulty." }, { status: 400 });
  }
  const difficulty = difficultyRaw;

  await ensureUserProfile(userId);

  let scenarioTitle = "";
  let openerText = "";
  let scenarioId = "";
  let manifest: Record<string, unknown>;

  if (typeof obj.scenarioId === "string" && obj.scenarioId.trim() !== "") {
    const s = getScenarioById(obj.scenarioId.trim());
    if (!s) return NextResponse.json({ error: "Unknown scenario id." }, { status: 404 });
    scenarioId = s.id;
    scenarioTitle = s.title;
    openerText = s.opener;
    manifest = { scenarioId, difficulty };
  } else if (obj.custom && typeof obj.custom === "object") {
    const c = obj.custom as Record<string, unknown>;
    const title = typeof c.title === "string" ? c.title.trim() : "";
    const opener = typeof c.opener === "string" ? c.opener.trim() : "";
    const personaName = typeof c.personaName === "string" ? c.personaName.trim() : "your partner";
    const personaSummary = typeof c.personaSummary === "string" ? c.personaSummary.trim() : "";
    const description = typeof c.description === "string" ? c.description.trim() : "";
    const topicsArr = Array.isArray(c.topics)
      ? (c.topics.filter((t) => typeof t === "string") as string[]).slice(0, 6)
      : [];
    if (title.length < 1 || opener.length < 1 || personaSummary.length < 20) {
      return NextResponse.json({ error: "Custom scenario needs a title, opener, and persona summary." }, { status: 400 });
    }
    scenarioId = "custom";
    scenarioTitle = title;
    openerText = opener;
    manifest = {
      scenarioId,
      difficulty,
      custom: { title, description, personaName, personaSummary, opener, topics: topicsArr },
    };
  } else if (typeof obj.customDescription === "string" && obj.customDescription.trim() !== "") {
    const { scenario: gen } = await generateCustomScenario({ description: obj.customDescription });
    scenarioId = "custom";
    scenarioTitle = gen.title;
    openerText = gen.opener;
    manifest = { scenarioId, difficulty, custom: gen };
  } else {
    return NextResponse.json({ error: "Missing scenarioId or custom payload." }, { status: 400 });
  }

  const sessionId = randomUUID();

  await createPracticeSession({
    id: sessionId,
    userId,
    kind: "simulation_draft",
    title: scenarioTitle,
    segmentsJson: JSON.stringify(manifest),
  });
  await insertSimulationTurn({
    id: randomUUID(),
    sessionId,
    turnIndex: 0,
    role: "assistant",
    text: openerText,
    audioRelativePath: null,
    durationMs: null,
  });

  return NextResponse.json({
    ok: true,
    userId,
    sessionId,
    scenarioId,
    scenarioTitle,
    difficulty,
    header: scenarioId === "custom" ? scenarioTitle : describeSimulationHeader(getScenarioById(scenarioId)!, difficulty),
    openerText,
  });
}
