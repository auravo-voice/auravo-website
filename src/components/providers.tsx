"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import type { AuthSessionSnapshot } from "@/lib/auth/session-snapshot";

export function AppProviders({
  initialAuthSession,
  children,
}: {
  initialAuthSession?: AuthSessionSnapshot;
  children: React.ReactNode;
}) {
  return <AuthProvider initialSession={initialAuthSession}>{children}</AuthProvider>;
}
