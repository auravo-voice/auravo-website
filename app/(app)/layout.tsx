import { AppChrome } from "@/components/app-chrome";
import { getAuthUserDisplayName } from "@/lib/auth/user-display-name";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userDisplayName = (await getAuthUserDisplayName()) ?? "Learner";
  return <AppChrome userDisplayName={userDisplayName}>{children}</AppChrome>;
}
