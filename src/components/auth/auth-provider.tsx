"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import type { AuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { readJsonResponse } from "@/lib/api/read-json-response";

export const AUTH_SESSION_CHANGED_EVENT = "auravo:auth-session-changed";

type AuthContextValue = {
  session: AuthSessionSnapshot;
  isLoading: boolean;
  refreshSession: () => Promise<AuthSessionSnapshot>;
  setSession: (next: AuthSessionSnapshot) => void;
  signOut: () => Promise<void>;
};

const EMPTY_SESSION: AuthSessionSnapshot = { user: null, pocketBaseAuth: false };

const AuthContext = React.createContext<AuthContextValue | null>(null);

function parseSessionPayload(data: Record<string, unknown>): AuthSessionSnapshot {
  const pocketBaseAuth = data.pocketBaseAuth === true;
  const rawUser = data.user;
  if (!rawUser || typeof rawUser !== "object") {
    return { user: null, pocketBaseAuth };
  }
  const u = rawUser as Record<string, unknown>;
  const id = typeof u.id === "string" ? u.id : "";
  const displayName = typeof u.displayName === "string" ? u.displayName : "";
  const email = typeof u.email === "string" ? u.email : null;
  if (!id || !displayName) {
    return { user: null, pocketBaseAuth };
  }
  return { user: { id, displayName, email }, pocketBaseAuth };
}

async function fetchAuthSession(): Promise<AuthSessionSnapshot> {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  const data = await readJsonResponse(res);
  if (!res.ok) return EMPTY_SESSION;
  return parseSessionPayload(data);
}

export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession?: AuthSessionSnapshot;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = React.useState<AuthSessionSnapshot>(initialSession ?? EMPTY_SESSION);
  const [isLoading, setIsLoading] = React.useState(initialSession == null);
  const refreshInFlight = React.useRef<Promise<AuthSessionSnapshot> | null>(null);
  const hasLoadedRef = React.useRef(initialSession != null);

  const refreshSession = React.useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const promise = (async () => {
      if (!hasLoadedRef.current) setIsLoading(true);
      try {
        const next = await fetchAuthSession();
        setSession(next);
        hasLoadedRef.current = true;
        return next;
      } finally {
        setIsLoading(false);
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = promise;
    return promise;
  }, []);

  const signOut = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(EMPTY_SESSION);
    window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
  }, []);

  React.useEffect(() => {
    if (initialSession == null) {
      void refreshSession();
    }
  }, [initialSession, refreshSession]);

  React.useEffect(() => {
    void refreshSession();
  }, [pathname, refreshSession]);

  React.useEffect(() => {
    const onFocus = () => void refreshSession();
    const onAuthChanged = () => void refreshSession();
    window.addEventListener("focus", onFocus);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    };
  }, [refreshSession]);

  const value = React.useMemo(
    () => ({
      session,
      isLoading,
      refreshSession,
      setSession,
      signOut,
    }),
    [session, isLoading, refreshSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

/** Notify all mounted screens that cookies changed after sign-in. */
export function notifyAuthSessionChanged(): void {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}
