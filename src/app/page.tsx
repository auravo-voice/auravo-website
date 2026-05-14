import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  Mic2,
  PlayCircle,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AuravoMark, VocaBadge } from "@/components/brand";
import { VoiceWaveform } from "@/components/voice-waveform";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Four core product pillars (PRD-aligned), written for learner outcomes. */
const pillars = [
  {
    title: "Adaptive learning paths",
    body: "Your baseline shapes a personalized plan—daily exercises that adapt after every session so you keep leveling up where it matters most.",
  },
  {
    title: "Simulated conversations",
    body: "Rehearse interviews, client calls, presentations, and networking moments with realistic scenarios and difficulty that match your goals.",
  },
  {
    title: "Progress journal & replay",
    body: "See how you improve over time with timelines, trends, and session replay—so growth feels visible, not guesswork.",
  },
  {
    title: "Meeting prep mode",
    body: "Walk into agendas prepared—talking points, rehearsal runs, and focused feedback so high-stakes meetings feel practiced, not improvised.",
  },
] as const;

const outcomeMoments = [
  {
    title: "Track your speaking growth",
    body: "Clarity, pace, structure, and confidence—turn subjective “how did I sound?” into progress you can see week over week.",
    icon: TrendingUp,
  },
  {
    title: "Practice before real interviews",
    body: "Train answers under pressure, refine how you open and close, and build presence before you sit across from a hiring panel.",
    icon: Briefcase,
  },
  {
    title: "Replay your progress",
    body: "Listen back, spot habits, and celebrate wins. Replay makes improvement tangible—and easier to repeat on purpose.",
    icon: PlayCircle,
  },
  {
    title: "Prepare for high-stakes conversations",
    body: "Exec updates, stakeholder meetings, and tough Q&A—rehearse the moments that move your work forward.",
    icon: CalendarDays,
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,102,0,0.14),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(204,0,0,0.1),_transparent_50%)]" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <AuravoMark className="h-10 max-w-[min(220px,55vw)] sm:h-11" />
          <div className="flex flex-col leading-tight">
            <VocaBadge className="w-fit scale-90 origin-left max-sm:scale-[0.85]" />
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/auth">Sign in</Link>
          </Button>
          <Button className="gap-2 shadow-primary/25" variant="glow" asChild>
            <Link href="/onboarding">
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 pb-16 pt-6 sm:px-6 lg:gap-24 lg:px-8 lg:pb-20 lg:pt-4">
        {/* Hero */}
        <div className="flex flex-col gap-16 lg:flex-row lg:items-center lg:gap-12">
          <section className="flex-1 space-y-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Mic2 className="size-3.5" aria-hidden />
                Voice-first communication coaching
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <Shield className="size-3 text-primary" aria-hidden />
                Privacy-first · secure voice processing
              </span>
            </div>

            <div className="space-y-5">
              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Speak with confidence.
                <span className="mt-1 block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Your personal communication coach.
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                Auravo helps professionals and students train how they sound—not just what they say—with personalized AI
                coaching, realistic speaking simulations, interview and meeting practice, real-time feedback, and measurable
                progress you can replay and build on daily.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="xl" className="gap-2 shadow-primary/30" variant="glow" asChild>
                <Link href="/onboarding">
                  Start free
                  <Sparkles className="size-4" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/dashboard">Explore the product</Link>
              </Button>
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Built for career readiness.</span> Whether you are preparing
              for interviews, leading meetings, presenting to a room, or growing confidence in everyday professional English,
              Auravo is your daily space to practice, reflect, and improve—like Duolingo discipline meets interview coaching
              depth.
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="size-4 shrink-0 text-primary" aria-hidden />
                Your sessions stay private
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
                Secure voice processing you can trust
              </div>
            </div>
          </section>

          <section className="flex w-full flex-1 flex-col justify-center lg:max-w-md">
            <Card className="border-primary/20 bg-card/70 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Practice space</p>
                    <p className="mt-1 font-display text-lg text-foreground">Train your voice, not a chatbot</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Short sessions designed for speaking—feedback you can act on immediately.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full border border-border/80 bg-muted/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Private
                  </div>
                </div>
                <VoiceWaveform className="h-20" bars={16} />
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                    <p className="font-medium text-foreground">Real-time coaching signals</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Pace, clarity, structure, and presence—so each rep makes the next conversation easier.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                    <p className="font-medium text-foreground">Scenarios that feel like real life</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Interviews, meetings, pitches, and networking—practice the moments that raise the stakes.
                    </p>
                  </div>
                </div>
                <Button variant="secondary" className="w-full" asChild>
                  <Link href="/auth">Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Emotional outcomes */}
        <section className="space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why learners choose Auravo</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Communication mastery, one session at a time
            </h2>
            <p className="text-lg text-muted-foreground">
              Aspirational, structured, and grounded in outcomes—so you walk into interviews and rooms feeling prepared,
              not lucky.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {outcomeMoments.map(({ title, body, icon: Icon }) => (
              <Card key={title} className="border-border/70 bg-background/35 transition-colors hover:border-primary/25">
                <CardContent className="flex gap-4 p-6 sm:p-7">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="space-y-2">
                    <p className="font-display text-lg font-semibold leading-snug">{title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Four pillars */}
        <section className="space-y-8 border-t border-border/60 pt-16">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">How Auravo works</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Four capabilities that cover the full communication journey
            </h2>
            <p className="text-lg text-muted-foreground">
              From first assessment to meeting day—adaptive paths, simulations, measurable progress, and prep when the
              calendar gets serious.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((h) => (
              <Card key={h.title} className="border-border/70 bg-card/40">
                <CardContent className="space-y-3 p-6">
                  <p className="font-display text-base font-semibold leading-snug">{h.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{h.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/80 to-accent/5 px-6 py-12 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Ready to sound like the communicator you want to become?
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Start with a short goal setup—then build a streak of focused speaking practice with feedback you can trust.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="gap-2 shadow-primary/25" variant="glow" asChild>
                <Link href="/onboarding">
                  Begin onboarding
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth">I already have an account</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
