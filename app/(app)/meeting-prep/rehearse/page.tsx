import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getServerPocketBase } from "@/lib/pocketbase/server";
import { PB } from "@/db/collections";
import { listSimulationTurns } from "@/db/queries/simulations";
import { getAuthenticatedUserId } from "@/lib/auth/session";
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

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect(`/login?redirect=${encodeURIComponent(`/meeting-prep/rehearse?session=${sessionId}`)}`);
  }

  const pb = await getServerPocketBase();
  let row: {
    user?: string;
    kind?: string;
    title?: string;
    segments_json?: string;
  };
  try {
    row = await pb.collection(PB.practiceSessions).getOne(sessionId);
  } catch {
    return <MissingSessionCard reason="That rehearsal could not be found." />;
  }

  const ownerId = typeof row.user === "string" ? row.user : "";
  if (!ownerId || ownerId !== userId) {
    return <MissingSessionCard reason="That rehearsal does not belong to your account." />;
  }
  const kind = typeof row.kind === "string" ? row.kind : "";
  if (kind !== "meeting_rehearsal_draft" && kind !== "meeting_rehearsal") {
    return <MissingSessionCard reason="That session is not a meeting rehearsal." />;
  }

  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = row.segments_json ? (JSON.parse(row.segments_json) as Record<string, unknown>) : null;
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
    title: typeof row.title === "string" ? row.title : "Meeting rehearsal",
    meetingLabel,
    audienceLabel,
    ctx,
    plan,
    opener: initialOpener,
    alreadyFinalized: kind === "meeting_rehearsal",
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
