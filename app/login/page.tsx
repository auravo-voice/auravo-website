import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuravoMark, VocaBadge } from "@/components/brand";
import { VoiceWaveform } from "@/components/voice-waveform";
import { AuthForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between border-r border-border/80 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-10 lg:flex">
        <AsideTop />
        <AsideMiddle />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} auravo</p>
      </div>
      <MainPanel />
    </div>
  );
}

function AsideTop() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AuravoMark className="h-11 max-w-[min(240px,70vw)]" />
      <VocaBadge className="w-fit scale-90 origin-left" />
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
        Your voice, your infrastructure.
      </h2>
      <VoiceWaveform className="h-16 w-56 opacity-90" />
    </div>
  );
}

function MainPanel() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
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
