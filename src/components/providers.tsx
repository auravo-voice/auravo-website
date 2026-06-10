"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { AuthProvider } from "@/components/auth/auth-provider";
import type { AuthSessionSnapshot } from "@/lib/auth/session-snapshot";

export function AppProviders({
  initialAuthSession,
  children,
}: {
  initialAuthSession?: AuthSessionSnapshot;
  children: React.ReactNode;
}) {
  return (
    <AuthProvider initialSession={initialAuthSession}>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} {...props}>
      {children}
    </NextThemesProvider>
  );
}
