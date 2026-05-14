import type { Metadata } from "next";
import Link from "next/link";
import { Apple, Globe, Mail } from "lucide-react";
import { AuravoMark, VocaBadge } from "@/components/brand";
import { VoiceWaveform } from "@/components/voice-waveform";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthPage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between border-r border-border/80 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-10 lg:flex">
        <div className="flex flex-wrap items-center gap-3">
          <AuravoMark className="h-11 max-w-[min(240px,70vw)]" />
          <VocaBadge className="w-fit scale-90 origin-left" />
        </div>
        <div className="space-y-6">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
            Your voice, your infrastructure.
          </h2>
          <p className="text-sm text-muted-foreground">
            Authentication will use NextAuth or a FastAPI-issued session—this page is a visual and routing
            placeholder per the phased MVP plan.
          </p>
          <VoiceWaveform className="h-16 w-56 opacity-90" />
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} auravo</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-md border-border/80 shadow-xl shadow-primary/5">
          <CardHeader className="space-y-1">
            <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
            <CardDescription>Email, Google, and Apple flows ship with the backend phase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3">
              <Button variant="outline" className="w-full gap-2" disabled>
                <Globe className="size-4" />
                Continue with Google
              </Button>
              <Button variant="outline" className="w-full gap-2" disabled>
                <Apple className="size-4" />
                Continue with Apple
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              or email
              <Separator className="flex-1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <Button className="w-full gap-2" disabled>
              <Mail className="size-4" />
              Sign in (disabled)
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              New to auravo?{" "}
              <Link href="/onboarding" className="font-medium text-primary underline-offset-4 hover:underline">
                Continue onboarding
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
