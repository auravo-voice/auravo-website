import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { practiceSession } from "@/db/schema";
import { ensureUserProfile } from "@/db/queries/user";
import { insertSimulationTurnSync } from "@/db/queries/simulations";
import { getScenarioById, isDifficulty } from "@/lib/simulations/library";
import { generateCustomScenario } from "@/lib/simulations/turn-coach";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { describeSimulationHeader } from "@/lib/simulations/persona";

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
  const cookieStore = await cookies();
  let userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value ?? "";
  if (!userId) userId = randomUUID();

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
  // `segments_json` carries the runtime persona — static scenarios resolve via library, custom carry their persona
  // verbatim so /api/simulations/turn does not need a side cache.
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
    // Convenience: server-side LLM expansion when only a description was provided.
    const { scenario: gen } = await generateCustomScenario({ description: obj.customDescription });
    scenarioId = "custom";
    scenarioTitle = gen.title;
    openerText = gen.opener;
    manifest = { scenarioId, difficulty, custom: gen };
  } else {
    return NextResponse.json({ error: "Missing scenarioId or custom payload." }, { status: 400 });
  }

  const sessionId = randomUUID();
  const now = Date.now();
  const db = getDb();
  db.transaction((tx) => {
    tx.insert(practiceSession)
      .values({
        id: sessionId,
        userId,
        // Draft kind ensures it does not count toward streak/timeline until finalize.
        kind: "simulation_draft",
        title: scenarioTitle,
        // Placeholder audio path until first user turn fills it in; cannot be null per schema.
        audioRelativePath: `uploads/${sessionId}.placeholder`,
        durationMs: null,
        createdAt: now,
        segmentsJson: JSON.stringify(manifest),
      })
      .run();
  });
  insertSimulationTurnSync({
    id: randomUUID(),
    sessionId,
    turnIndex: 0,
    role: "assistant",
    text: openerText,
    audioRelativePath: null,
    durationMs: null,
  });

  const res = NextResponse.json({
    ok: true,
    userId,
    sessionId,
    scenarioId,
    scenarioTitle,
    difficulty,
    header: scenarioId === "custom" ? scenarioTitle : describeSimulationHeader(getScenarioById(scenarioId)!, difficulty),
    openerText,
  });
  res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  return res;
}
