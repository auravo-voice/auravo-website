import Link from "next/link";
import { AssessmentResultsSummary } from "../assessment-results-summary";
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
  const results = await loadBaselineResultsForUser(userId, sessionId);

  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">No baseline on file yet</CardTitle>
          <CardDescription>
            Complete the four-part voice assessment once. Your scores, coaching plan, and transcript are saved in your
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

  return (
    <>
      <AssessmentResultsSummary results={results} />
      <div className="flex flex-wrap justify-center gap-3 pb-8">
        <Button variant="glow" asChild>
          <Link href="/practice/today">Start today&apos;s practice</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/progress">View progress journal</Link>
        </Button>
      </div>
    </>
  );
}
