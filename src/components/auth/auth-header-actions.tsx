"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

/** Header auth controls for public flows (onboarding, marketing). */
export function AuthHeaderActions() {
  const { session, isLoading, signOut } = useAuth();
  const user = session.user;
  const signedIn = session.pocketBaseAuth || user != null;

  if (isLoading && !user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled>
          …
        </Button>
      </div>
    );
  }

  if (signedIn && user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">{user.displayName}</span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        {session.pocketBaseAuth ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void signOut().then(() => {
                window.location.href = "/login";
              });
            }}
          >
            Sign out
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/login">Sign in</Link>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard">Skip for now</Link>
      </Button>
    </div>
  );
}
