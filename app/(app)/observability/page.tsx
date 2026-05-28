import { redirect } from "next/navigation";
import { ObservabilityDashboard } from "./observability-dashboard";
import { listObservabilitySessions } from "@/db/queries/observability";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { getStorageBackend } from "@/lib/storage/env";
import { isAdminUser } from "@/lib/auth/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Admin access required</CardTitle>
          <CardDescription>
            This dashboard is restricted to admins. Ask an admin to add your user id to `AURAVO_ADMIN_USER_IDS` or grant
            your PocketBase `users` record an admin role flag.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const storage = getStorageBackend();
  if (storage !== "sqlite") {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Observability dashboard unavailable</CardTitle>
          <CardDescription>
            This dashboard currently reads local SQLite session data. Set `AURAVO_STORAGE=sqlite` to use it.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Current storage mode: {storage}</CardContent>
      </Card>
    );
  }

  const rows = await listObservabilitySessions(120);
  return <ObservabilityDashboard rows={rows} />;
}
