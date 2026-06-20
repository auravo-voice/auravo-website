import Link from "next/link";
import { BaselineResultsView } from "./baseline-results-view";
import { loadBaselineResultsForUser } from "@/lib/assessment/load-baseline-results";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function AssessmentResultsBody({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string | null;
}) {
  const loaded = await loadBaselineResultsForUser(userId, sessionId);

  if (!loaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">No baseline on file yet</CardTitle>
          <CardDescription>
            Finish Quick Analysis once. Your scores, coaching insights, and transcript are saved in your
            account and will appear here afterward.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button variant="glow" asChild>
            <Link href="/quick-analysis">Start Quick Analysis</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <BaselineResultsView results={loaded.results} layout={loaded.layout} />;
}
