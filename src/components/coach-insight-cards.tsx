import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";

type Props = {
  biggestIssue?: string | null;
  strength?: string | null;
  patterns?: CoachingPattern[];
  acousticPatterns?: AcousticCoachingPattern[];
};

export function CoachInsightCards({ biggestIssue, strength, patterns = [], acousticPatterns = [] }: Props) {
  const hasContent =
    (biggestIssue && biggestIssue.trim()) ||
    (strength && strength.trim()) ||
    patterns.length > 0 ||
    acousticPatterns.length > 0;
  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-4">
      {biggestIssue?.trim() ? (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Priority focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{biggestIssue}</p>
          </CardContent>
        </Card>
      ) : null}

      {strength?.trim() ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">What you did well</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{strength}</p>
          </CardContent>
        </Card>
      ) : null}

      {patterns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Patterns in your speech</CardTitle>
            <CardDescription>Specific habits with evidence from what you said.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {patterns.map((p, i) => (
              <div key={`${p.pattern}-${i}`} className="rounded-xl border border-border/60 bg-muted/15 p-4">
                <p className="font-medium text-foreground">{p.pattern}</p>
                <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                  &ldquo;{p.evidence}&rdquo;
                </blockquote>
                <p className="mt-2 text-sm text-muted-foreground">{p.impact}</p>
                <p className="mt-2 text-sm font-medium text-foreground">Try this week: {p.fix}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {acousticPatterns.length > 0 ? (
        <Card className="border-sky-500/15">
          <CardHeader>
            <CardTitle className="text-lg">Voice delivery patterns</CardTitle>
            <CardDescription>How energy and pitch lined up with your words.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {acousticPatterns.map((p, i) => (
              <div key={`${p.pattern}-${i}`} className="rounded-xl border border-border/60 bg-muted/15 p-4">
                <p className="font-medium text-foreground">{p.pattern}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.timestamps}</p>
                <p className="mt-2 text-sm font-medium text-foreground">Try this week: {p.fix}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
