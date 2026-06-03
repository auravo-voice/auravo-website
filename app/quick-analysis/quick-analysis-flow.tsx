"use client";

import * as React from "react";
import { AuravoMark } from "@/components/brand";
import { CoachInsightCards } from "@/components/coach-insight-cards";
import { Button } from "@/components/ui/button";
import { VisualPromptScene } from "@/app/(app)/assessment/visual-prompt-scene";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { ContactForm } from "./components/ContactForm";
import { QuestionStep } from "./components/QuestionStep";
import { RadarSnapshot } from "./components/RadarSnapshot";
import { QUESTIONS, STEP_PROGRESS, WELCOME_SPEECH } from "./copy";
import { useBrowserSpeechRecognition } from "./hooks/useBrowserSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";

export type QuickAnalysisStep =
  | "welcome"
  | "q1_city"
  | "q2_duration"
  | "q3_about_city"
  | "midpoint"
  | "q4_objects"
  | "q5_visual"
  | "results"
  | "contact_form"
  | "thank_you";

type DeterministicResponse = {
  scores: SixDimensionScores;
  transcript: string;
  lowConfidenceWords: string[];
};

type FullAnalysisResponse = {
  scores: SixDimensionScores;
  transcript: string;
  coachSummary: {
    biggestIssue: string | null;
    strength: string | null;
    patterns: CoachingPattern[];
    acousticPatterns: AcousticCoachingPattern[];
    summary: string;
    strengths: string[];
    improvementAreas: string[];
  };
};

const DEFAULT_SCORES: SixDimensionScores = {
  pronunciation: 70,
  grammar: 70,
  fluency: 70,
  vocabulary: 70,
  filler_words: 70,
  pacing: 70,
};

const SCORE_TIMEOUT_MS = 20_000;
const Q3_AUDIO_FALLBACK_TIMEOUT_MS = 60_000;

async function scoreFromTranscript(transcript: string): Promise<DeterministicResponse> {
  const form = new FormData();
  form.append("mode", "transcript");
  form.append("transcript", transcript);
  const res = await fetch("/api/quick-analysis/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(SCORE_TIMEOUT_MS),
  });
  const data = (await res.json()) as DeterministicResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Scoring failed");
  return data;
}

/** Whisper only for midpoint when browser did not capture Q3 text (Safari fallback). */
async function transcribeAndScoreAudio(blob: Blob): Promise<DeterministicResponse> {
  if (blob.size < 800) {
    throw new Error("Recording was too short. Hold the mic a little longer and try again.");
  }
  const form = new FormData();
  form.append("mode", "deterministic");
  form.append("audio", blob, "segment.webm");
  const res = await fetch("/api/quick-analysis/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(Q3_AUDIO_FALLBACK_TIMEOUT_MS),
  });
  const data = (await res.json()) as DeterministicResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Analysis failed");
  return data;
}

async function analyzeFull(blobs: Blob[]): Promise<FullAnalysisResponse> {
  const form = new FormData();
  form.append("mode", "full");
  for (const blob of blobs) {
    form.append("audio", blob, "segment.webm");
  }
  const res = await fetch("/api/quick-analysis/analyze", { method: "POST", body: form });
  const data = (await res.json()) as FullAnalysisResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Full analysis failed");
  return data;
}

export function QuickAnalysisFlow() {
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const { recording, start: startRecording, stop: stopRecording } = useVoiceRecorder();
  const browserStt = useBrowserSpeechRecognition();

  const [step, setStep] = React.useState<QuickAnalysisStep>("welcome");
  const [audioBlobs, setAudioBlobs] = React.useState<Blob[]>([]);
  const [midpointScores, setMidpointScores] = React.useState<SixDimensionScores | null>(null);
  const [displayScores, setDisplayScores] = React.useState<SixDimensionScores>(DEFAULT_SCORES);
  const [coachSummary, setCoachSummary] = React.useState<FullAnalysisResponse["coachSummary"] | null>(null);
  const [lastTranscript, setLastTranscript] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysisStatus, setAnalysisStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showContact, setShowContact] = React.useState(false);
  const [fullPath, setFullPath] = React.useState(false);

  const maxDurationRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokeRef = React.useRef<string | null>(null);
  const recordingRef = React.useRef(false);

  React.useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const clearMaxDuration = React.useCallback(() => {
    if (maxDurationRef.current) {
      clearTimeout(maxDurationRef.current);
      maxDurationRef.current = null;
    }
  }, []);

  React.useEffect(() => () => {
    stopSpeaking();
    browserStt.abort();
    clearMaxDuration();
  }, [browserStt, stopSpeaking, clearMaxDuration]);

  React.useEffect(() => {
    if (step === "welcome" || step === "thank_you") return;
    const text =
      step === "midpoint"
        ? QUESTIONS.midpoint
        : step === "results"
          ? QUESTIONS.results
          : step in QUESTIONS
            ? QUESTIONS[step as keyof typeof QUESTIONS]
            : null;
    if (!text || spokeRef.current === step) return;
    spokeRef.current = step;
    const t = window.setTimeout(() => speak(text), 300);
    return () => clearTimeout(t);
  }, [step, speak]);

  const goNextAfterQuestion = React.useCallback((next: QuickAnalysisStep) => {
    spokeRef.current = null;
    setStep(next);
  }, []);

  /** Save clip only — same pattern as assessment segment upload (no scoring yet). */
  const saveSegment = React.useCallback(
    (blob: Blob, browserTranscript: string, next: QuickAnalysisStep) => {
      const text = browserTranscript.trim();
      setAudioBlobs((prev) => [...prev, blob]);
      setLastTranscript(text.length > 0 ? text : null);
      setError(null);
      goNextAfterQuestion(next);
    },
    [goNextAfterQuestion],
  );

  /** One scoring pass after Q3 for the midpoint radar (not after every clip). */
  const scoreMidpointFromQ3 = React.useCallback(async (q3Transcript: string, q3Blob: Blob) => {
    setAnalyzing(true);
    setAnalysisStatus("Building your snapshot…");
    setError(null);
    try {
      const hasText = q3Transcript.trim().split(/\s+/).filter(Boolean).length >= 3;
      const result = hasText
        ? await scoreFromTranscript(q3Transcript.trim())
        : await transcribeAndScoreAudio(q3Blob);
      setMidpointScores(result.scores);
      setDisplayScores(result.scores);
      setLastTranscript(result.transcript);
      goNextAfterQuestion("midpoint");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not build your snapshot.";
      setError(
        e instanceof DOMException && e.name === "TimeoutError"
          ? "Analysis timed out. Use Chrome or Edge, or try again."
          : msg,
      );
    } finally {
      setAnalyzing(false);
      setAnalysisStatus(null);
    }
  }, [goNextAfterQuestion]);

  const runFullAnalysis = React.useCallback(
    async (allBlobs: Blob[]) => {
      setAnalyzing(true);
      setAnalysisStatus("Running full analysis…");
      setError(null);
      try {
        const result = await analyzeFull(allBlobs);
        setDisplayScores(result.scores);
        setCoachSummary(result.coachSummary);
        setLastTranscript(result.transcript);
        setShowContact(true);
        setFullPath(true);
        spokeRef.current = null;
        setStep("results");
        speak(QUESTIONS.results);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Full analysis failed.");
      } finally {
        setAnalyzing(false);
        setAnalysisStatus(null);
      }
    },
    [speak],
  );

  const finishRecording = React.useCallback(async () => {
    clearMaxDuration();
    try {
      const [blob, browserTranscript] = await Promise.all([stopRecording(), browserStt.stop()]);

      if (step === "q1_city") {
        saveSegment(blob, browserTranscript, "q2_duration");
        return;
      }
      if (step === "q2_duration") {
        saveSegment(blob, browserTranscript, "q3_about_city");
        return;
      }
      if (step === "q3_about_city") {
        setAudioBlobs((prev) => [...prev, blob]);
        await scoreMidpointFromQ3(browserTranscript, blob);
        return;
      }
      if (step === "q4_objects") {
        saveSegment(blob, browserTranscript, "q5_visual");
        return;
      }
      if (step === "q5_visual") {
        const allBlobs = [...audioBlobs, blob];
        setAudioBlobs(allBlobs);
        await runFullAnalysis(allBlobs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish recording.");
      setAnalyzing(false);
      setAnalysisStatus(null);
    }
  }, [audioBlobs, browserStt, clearMaxDuration, runFullAnalysis, saveSegment, scoreMidpointFromQ3, step, stopRecording]);

  const onToggleRecord = React.useCallback(() => {
    if (analyzing) return;
    if (recordingRef.current) {
      void finishRecording();
      return;
    }
    setError(null);
    setLastTranscript(null);
    clearMaxDuration();
    browserStt.start();
    void startRecording();
    if (step === "q3_about_city") {
      maxDurationRef.current = setTimeout(() => {
        if (recordingRef.current) void finishRecording();
      }, 90_000);
    } else if (step === "q5_visual") {
      maxDurationRef.current = setTimeout(() => {
        if (recordingRef.current) void finishRecording();
      }, 60_000);
    }
  }, [analyzing, browserStt, clearMaxDuration, finishRecording, startRecording, step]);

  const scoresForDisplay = midpointScores && (step === "midpoint" || (showContact && !fullPath))
    ? midpointScores
    : displayScores;

  const stepProgress = STEP_PROGRESS[step];

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-6 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,102,0,0.1),transparent)]" />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-8">
        <AuravoMark className="h-10 max-w-[200px]" />

        {stepProgress ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Step {stepProgress.current} of {stepProgress.total}
          </p>
        ) : null}

        {error ? (
          <p className="w-full rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {step === "welcome" ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Quick Analysis
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              A short, voice-first snapshot of your English — no account needed. Answer a few spoken prompts and see
              where you shine.
            </p>
            {browserStt.supported ? (
              <p className="text-xs text-muted-foreground">
                Chrome or Edge recommended. We score once after your city description, like the full assessment.
              </p>
            ) : (
              <p className="text-xs text-amber-200/90">
                For faster transcription, use Chrome or Edge. Otherwise scoring runs once at the checkpoint.
              </p>
            )}
            <Button
              size="lg"
              variant="glow"
              className="min-w-[12rem]"
              onClick={() => {
                speak(WELCOME_SPEECH, () => setStep("q1_city"));
              }}
            >
              Start
            </Button>
          </div>
        ) : null}

        {step === "q1_city" ? (
          <QuestionStep
            stepLabel={stepProgress ? `Step ${stepProgress.current} of ${stepProgress.total}` : undefined}
            question={QUESTIONS.q1_city}
            recording={recording}
            analyzing={false}
            onToggleRecord={onToggleRecord}
            transcript={lastTranscript}
          />
        ) : null}

        {step === "q2_duration" ? (
          <QuestionStep
            stepLabel={stepProgress ? `Step ${stepProgress.current} of ${stepProgress.total}` : undefined}
            question={QUESTIONS.q2_duration}
            recording={recording}
            analyzing={false}
            onToggleRecord={onToggleRecord}
            transcript={lastTranscript}
          />
        ) : null}

        {step === "q3_about_city" ? (
          <QuestionStep
            stepLabel={stepProgress ? `Step ${stepProgress.current} of ${stepProgress.total}` : undefined}
            question={QUESTIONS.q3_about_city}
            recording={recording}
            analyzing={analyzing}
            analysisStatus={analysisStatus}
            onToggleRecord={onToggleRecord}
            transcript={lastTranscript}
            maxDurationSec={90}
          />
        ) : null}

        {step === "midpoint" ? (
          <div className="flex w-full flex-col items-center gap-8">
            <h2 className="max-w-lg text-center font-display text-2xl font-semibold leading-snug text-foreground">
              {QUESTIONS.midpoint}
            </h2>
            <RadarSnapshot
              scores={scoresForDisplay}
              caption="Scores from your city description — fluency, pacing, pronunciation, grammar, and vocabulary."
            />
            {!showContact ? (
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="glow"
                  onClick={() => {
                    setFullPath(true);
                    setShowContact(false);
                    spokeRef.current = null;
                    setStep("q4_objects");
                  }}
                >
                  Yes, continue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    speak(QUESTIONS.thank_you_no);
                    setShowContact(true);
                  }}
                >
                  No thanks
                </Button>
              </div>
            ) : (
              <ContactForm
                scores={scoresForDisplay}
                onSuccess={() => {
                  speak(QUESTIONS.thank_you_submit);
                  setStep("thank_you");
                }}
              />
            )}
          </div>
        ) : null}

        {step === "q4_objects" ? (
          <QuestionStep
            stepLabel={stepProgress ? `Step ${stepProgress.current} of ${stepProgress.total}` : undefined}
            question={QUESTIONS.q4_objects}
            recording={recording}
            analyzing={false}
            onToggleRecord={onToggleRecord}
            transcript={lastTranscript}
          />
        ) : null}

        {step === "q5_visual" ? (
          <QuestionStep
            stepLabel={stepProgress ? `Step ${stepProgress.current} of ${stepProgress.total}` : undefined}
            question={QUESTIONS.q5_visual}
            recording={recording}
            analyzing={analyzing}
            analysisStatus={analysisStatus}
            onToggleRecord={onToggleRecord}
            transcript={lastTranscript}
            maxDurationSec={60}
          >
            <VisualPromptScene className="mx-auto w-full max-w-[320px] rounded-2xl border border-border/70" />
          </QuestionStep>
        ) : null}

        {step === "results" ? (
          <div className="flex w-full flex-col items-center gap-8">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground">Your English snapshot</h2>
            {analyzing ? (
              <p className="text-sm text-muted-foreground">{analysisStatus ?? "Building your full profile…"}</p>
            ) : (
              <>
                <RadarSnapshot scores={displayScores} />
                {coachSummary ? (
                  <div className="w-full">
                    <CoachInsightCards
                      biggestIssue={coachSummary.biggestIssue}
                      strength={coachSummary.strength}
                      patterns={coachSummary.patterns}
                      acousticPatterns={coachSummary.acousticPatterns}
                    />
                  </div>
                ) : null}
                {showContact ? (
                  <ContactForm
                    scores={displayScores}
                    onSuccess={() => {
                      speak(QUESTIONS.thank_you_submit);
                      setStep("thank_you");
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {step === "thank_you" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">Thank you</h2>
            <p className="max-w-md text-muted-foreground">
              We&apos;ll be in touch soon with a personalised plan. You can also{" "}
              <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                sign in
              </a>{" "}
              for the full Auravo experience.
            </p>
            <Button variant="outline" asChild>
              <a href="/">Back to home</a>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
