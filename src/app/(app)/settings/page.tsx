import { Bell, Globe2, Mic, Shield, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getLocalUserId } from "@/lib/auth/local-user-id";
import { ensureUserProfile } from "@/db/queries/user";
import { isOnboardingGoalId } from "@/lib/coach/dashboard";
import { SettingsGoalForm } from "./settings-goal-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getLocalUserId();
  // Read current goal from SQLite so the form preselects what onboarding/assessment saved.
  let initialGoalId: string | null = null;
  if (userId) {
    const profile = await ensureUserProfile(userId);
    if (profile.onboardingGoalId && isOnboardingGoalId(profile.onboardingGoalId)) {
      initialGoalId = profile.onboardingGoalId;
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Settings</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Profile &amp; preferences</h1>
        <p className="mt-2 text-muted-foreground">
          Your primary goal is saved locally and steers the dashboard narrative and recommended daily session.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="size-4" />
            Primary goal
          </CardTitle>
          <CardDescription>Switch focus any time — it updates next dashboard load.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsGoalForm initialGoalId={initialGoalId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="size-4" />
            Voice &amp; delivery
          </CardTitle>
          <CardDescription>Accent target and default session shape (preview — not yet persisted)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
          <p>Target accent, session length, and weekly schedule controls land in a follow-up phase. Goal selection above already steers today&apos;s recommended practice.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="size-4" />
            Notifications
          </CardTitle>
          <CardDescription>Daily nudges and streak alerts (preview)</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Notification delivery requires an authenticated account; controls light up when the auth phase ships.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="size-4" />
            Privacy &amp; data
          </CardTitle>
          <CardDescription>Local-first storage today, account-scoped controls later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Globe2 className="mt-0.5 size-4 shrink-0" />
            <p>
              Recordings and transcripts live in <code className="rounded bg-muted px-1">data/uploads</code> on this machine. Per-user retention, deletion controls, and export
              hooks ship with the auth phase.
            </p>
          </div>
          <Separator />
          <Button variant="destructive" size="sm" disabled>
            Delete all recordings (account-scoped only)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
