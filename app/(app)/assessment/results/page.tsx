import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AssessmentResultsBody } from "./assessment-results-body";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { isRecordId } from "@/lib/util/is-uuid-like";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ session?: string | string[] }>;
};

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 animate-pulse rounded-2xl bg-muted/50" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted/40" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted/35" />
    </div>
  );
}

export default async function AssessmentResultsPage({ searchParams }: PageProps) {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const rawSession = sp.session;
  const sessionFromUrl =
    typeof rawSession === "string" ? rawSession : Array.isArray(rawSession) ? rawSession[0] : null;
  const sessionId = sessionFromUrl && isRecordId(sessionFromUrl) ? sessionFromUrl : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-2 sm:px-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Baseline</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your baseline results
          </h1>
          <p className="mt-2 text-muted-foreground">
            Saved from your completed Quick Analysis — same layout as your live results.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
      </header>
      <Suspense fallback={<ResultsSkeleton />}>
        <AssessmentResultsBody userId={userId} sessionId={sessionId} />
      </Suspense>
    </div>
  );
}
