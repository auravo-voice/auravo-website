import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TalkingLabsLogoFull, BrandBadge } from "@/components/brand";
import { VoiceWaveform } from "@/components/voice-waveform";
import { AuthForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSessionSnapshot } from "@/lib/auth/session-snapshot";

export const metadata: Metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams?: Promise<{ redirect?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAuthSessionSnapshot();
  if (session.pocketBaseAuth && session.user) {
    const sp = searchParams ? await searchParams : {};
    const raw = sp.redirect;
    const target =
      typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
        ? raw
        : "/dashboard";
    redirect(target);
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between border-r border-border/80 bg-gradient-to-br from-primary/10 via-card to-accent/20 p-10 lg:flex">
        <AsideTop />
        <AsideMiddle />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Talking Labs</p>
      </div>
      <MainPanel />
    </div>
  );
}

function AsideTop() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TalkingLabsLogoFull className="h-20 w-auto" />
      <BrandBadge className="w-fit scale-90 origin-left" />
    </div>
  );
}

function AsideMiddle() {
  return (
    <AsideMiddleInner />
  );
}

function AsideMiddleInner() {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
        Learn, Practice, Communicate, Excel.
      </h2>
      <VoiceWaveform className="h-16 w-56 opacity-90" />
    </div>
  );
}

function MainPanel() {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md border-border/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <AuthForm mode="login" />
          </Suspense>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
