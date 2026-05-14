import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { practiceSession } from "@/db/schema";
import { listSimulationTurns } from "@/db/queries/simulations";
import { AURAVO_USER_ID_COOKIE } from "@/lib/auth/auravo-user-cookie";
import {
  AUDIENCES,
  MEETING_TYPES,
  isAudienceId,
  isMeetingType,
  isRehearsalDifficulty,
  isRehearsalMode,
  type MeetingPlan,
  type MeetingPrepContext,
} from "@/lib/meeting-prep/types";
import { MeetingRehearser, type RehearsalInit } from "./meeting-rehearser";

export const dynamic = "force-dynamic";

type SearchParams = { session?: string };

export default async function MeetingPrepRehearsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session.trim() : "";
  if (!sessionId) {
    redirect("/meeting-prep");
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value ?? "";
  if (!userId) {
    return <MissingSessionCard reason="No active user. Start the rehearsal from the prep page." />;
  }

  const db = getDb();
  const rows = await db
    .select({
      userId: practiceSession.userId,
      kind: practiceSession.kind,
      title: practiceSession.title,
      segmentsJson: practiceSession.segmentsJson,
    })
    .from(practiceSession)
    .where(eq(practiceSession.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId) {
    return <MissingSessionCard reason="That rehearsal does not belong to your session." />;
  }
  if (row.kind !== "meeting_rehearsal_draft" && row.kind !== "meeting_rehearsal") {
    return <MissingSessionCard reason="That session is not a meeting rehearsal." />;
  }

  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = row.segmentsJson ? (JSON.parse(row.segmentsJson) as Record<string, unknown>) : null;
  } catch {
    manifest = null;
  }
  if (
    !manifest ||
    typeof manifest.agenda !== "string" ||
    !isMeetingType(manifest.meetingType) ||
    !isAudienceId(manifest.audience) ||
    !isRehearsalDifficulty(manifest.difficulty) ||
    !isRehearsalMode(manifest.mode) ||
    typeof manifest.durationMin !== "number" ||
    !manifest.plan ||
    typeof manifest.plan !== "object"
  ) {
    return <MissingSessionCard reason="The rehearsal manifest is malformed." />;
  }

  const ctx: MeetingPrepContext = {
    agenda: manifest.agenda,
    meetingType: manifest.meetingType,
    audience: manifest.audience,
    difficulty: manifest.difficulty,
    mode: manifest.mode,
    durationMin: manifest.durationMin,
  };
  const plan = manifest.plan as MeetingPlan;

  const turns = await listSimulationTurns(sessionId);
  const initialTurns = turns.map((t) => ({ role: t.role, text: t.text }));
  const initialOpener = initialTurns.find((t) => t.role === "assistant")?.text ?? "Whenever you are ready, begin.";

  const meetingLabel = MEETING_TYPES.find((m) => m.id === ctx.meetingType)?.label ?? ctx.meetingType;
  const audienceLabel = AUDIENCES.find((a) => a.id === ctx.audience)?.label ?? ctx.audience;

  const init: RehearsalInit = {
    sessionId,
    title: row.title ?? "Meeting rehearsal",
    meetingLabel,
    audienceLabel,
    ctx,
    plan,
    opener: initialOpener,
    alreadyFinalized: row.kind === "meeting_rehearsal",
    initialTurns,
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Meeting prep</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {ctx.mode === "quick" ? "5-minute quick prep" : "Rehearsal"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {meetingLabel} · {audienceLabel} · {ctx.durationMin}-minute target ·{" "}
          {ctx.difficulty === "easy"
            ? "supportive audience"
            : ctx.difficulty === "medium"
              ? "engaged audience"
              : "skeptical audience"}
        </p>
      </header>
      <MeetingRehearser init={init} />
    </div>
  );
}

function MissingSessionCard({ reason }: { reason: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>We could not load that rehearsal</CardTitle>
          <CardDescription>{reason}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/meeting-prep">Back to meeting prep</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
