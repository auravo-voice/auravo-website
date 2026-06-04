"use client";

import * as React from "react";
import Link from "next/link";
import { AuravoMark } from "@/components/brand";
import { CoachInsightCards } from "@/components/coach-insight-cards";
import { Button } from "@/components/ui/button";
import { VisualPromptScene } from "@/app/(app)/assessment/visual-prompt-scene";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { ContactForm } from "./components/ContactForm";
import { DemoAmbient } from "./components/DemoAmbient";
import { QuestionStep } from "./components/QuestionStep";
import { RadarSnapshot } from "./components/RadarSnapshot";
import { SpokenCaption } from "./components/SpokenCaption";
import { VoiceOrb } from "./components/VoiceOrb";
import { WelcomeLine } from "./components/WelcomeLine";
import { QUESTIONS, STEP_PROGRESS, WELCOME_LINES, WELCOME_SPEECH } from "./copy";
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
const FULL_ANALYSIS_TIMEOUT_MS = 180_000;

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

async function analyzeFull(blobs: Blob[], transcriptPrefix: string): Promise<FullAnalysisResponse> {
  const form = new FormData();
  form.append("mode", "full");
  if (transcriptPrefix.trim()) {
    form.append("transcriptPrefix", transcriptPrefix.trim());
  }
  for (const blob of blobs) {
    form.append("audio", blob, "segment.webm");
  }
  const res = await fetch("/api/quick-analysis/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(FULL_ANALYSIS_TIMEOUT_MS),
  });
  const data = (await res.json()) as FullAnalysisResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Full analysis failed");
  return data;
}

function promptForStep(step: QuickAnalysisStep): string | null {
  if (step === "midpoint") return QUESTIONS.midpoint;
  if (step === "results") return QUESTIONS.results;
  if (step === "thank_you") return QUESTIONS.thank_you_page;
  if (step in QUESTIONS) return QUESTIONS[step as keyof typeof QUESTIONS];
  return null;
}

export function QuickAnalysisFlow() {
  const { speak, stop: stopSpeaking, speaking, caption } = useSpeechSynthesis();
  const { recording, start: startRecording, stop: stopRecording } = useVoiceRecorder();
  const browserStt = useBrowserSpeechRecognition();

  const [step, setStep] = React.useState<QuickAnalysisStep>("welcome");
  const [welcomeReady, setWelcomeReady] = React.useState(false);
  /** Q1/Q2 audio only (not sent to full Whisper concat). */
  const [audioBlobs, setAudioBlobs] = React.useState<Blob[]>([]);
  /** Q3–Q5 clips concatenated for final analysis. */
  const [analysisBlobs, setAnalysisBlobs] = React.useState<Blob[]>([]);
  const [earlyTranscriptParts, setEarlyTranscriptParts] = React.useState<string[]>([]);
  const [midpointScores, setMidpointScores] = React.useState<SixDimensionScores | null>(null);
  const [displayScores, setDisplayScores] = React.useState<SixDimensionScores>(DEFAULT_SCORES);
  const [coachSummary, setCoachSummary] = React.useState<FullAnalysisResponse["coachSummary"] | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysisStatus, setAnalysisStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showContact, setShowContact] = React.useState(false);
  const [fullPath, setFullPath] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  /** Browser-only STT hint — rendered after mount to avoid hydration mismatch. */
  const [clientHints, setClientHints] = React.useState<{
    showSttWarning: boolean;
  } | null>(null);

  const maxDurationRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokeRef = React.useRef<string | null>(null);
  const recordingRef = React.useRef(false);
  const welcomeStartedRef = React.useRef(false);
  const browserSttRef = React.useRef(browserStt);
  browserSttRef.current = browserStt;

  React.useEffect(() => {
    setMounted(true);
    setClientHints({ showSttWarning: !browserStt.supported });
  }, [browserStt.supported]);

  React.useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const clearMaxDuration = React.useCallback(() => {
    if (maxDurationRef.current) {
      clearTimeout(maxDurationRef.current);
      maxDurationRef.current = null;
    }
  }, []);

  /** Unmount only — do not depend on `browserStt` (new object every render was canceling TTS). */
  React.useEffect(() => {
    return () => {
      stopSpeaking();
      browserSttRef.current.abort();
      clearMaxDuration();
    };
  }, [stopSpeaking, clearMaxDuration]);

  const announceStep = React.useCallback(
    (targetStep: QuickAnalysisStep) => {
      const text = promptForStep(targetStep);
      if (!text) return;
      spokeRef.current = targetStep;
      speak(text);
    },
    [speak],
  );

  React.useEffect(() => {
    if (step !== "welcome" || welcomeStartedRef.current) return;
    welcomeStartedRef.current = true;
    setWelcomeReady(false);
    spokeRef.current = "welcome";
    speak(WELCOME_SPEECH, () => setWelcomeReady(true));
  }, [step, speak]);

  React.useEffect(() => {
    if (step === "welcome") return;
    if (spokeRef.current === step) return;
    announceStep(step);
  }, [step, announceStep]);

  const goNextAfterQuestion = React.useCallback((next: QuickAnalysisStep) => {
    spokeRef.current = null;
    setStep(next);
  }, []);

  const appendEarlyTranscript = React.useCallback((browserTranscript: string) => {
    const text = browserTranscript.trim();
    if (text.length > 0) {
      setEarlyTranscriptParts((prev) => [...prev, text]);
    }
  }, []);

  const saveSegment = React.useCallback(
    (blob: Blob, browserTranscript: string, next: QuickAnalysisStep) => {
      const text = browserTranscript.trim();
      setAudioBlobs((prev) => [...prev, blob]);
      setError(null);
      goNextAfterQuestion(next);
    },
    [goNextAfterQuestion],
  );

  const scoreMidpointFromQ3 = React.useCallback(
    async (q3Transcript: string, q3Blob: Blob) => {
      setAnalyzing(true);
      setAnalysisStatus("Building your snapshot…");
      setError(null);
      try {
        const trimmed = q3Transcript.trim();
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        const result =
          wordCount >= 1 ? await scoreFromTranscript(trimmed) : await transcribeAndScoreAudio(q3Blob);
        setMidpointScores(result.scores);
        setDisplayScores(result.scores);
        goNextAfterQuestion("midpoint");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not build your snapshot.";
        const isTranscription =
          msg.includes("Speech recognition") ||
          msg.includes("transcription") ||
          msg.includes("Whisper") ||
          msg.includes("faster-whisper");
        setError(
          e instanceof DOMException && e.name === "TimeoutError"
            ? "Analysis timed out. Use Chrome or Edge, or try again."
            : isTranscription
              ? "Server speech recognition is unavailable. Use Chrome or Edge so we can score from your voice live, or fix local Whisper (npm run setup:transcription with Python 3.11 or 3.12)."
              : msg,
        );
      } finally {
        setAnalyzing(false);
        setAnalysisStatus(null);
      }
    },
    [goNextAfterQuestion],
  );

  const runFullAnalysis = React.useCallback(
    async (blobs: Blob[], transcriptPrefix: string) => {
      setAnalyzing(true);
      setAnalysisStatus("Running full analysis…");
      setError(null);
      try {
        const result = await analyzeFull(blobs, transcriptPrefix);
        setDisplayScores(result.scores);
        setCoachSummary(result.coachSummary);
        setShowContact(true);
        setFullPath(true);
        setStep("results");
        announceStep("results");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Full analysis failed.";
        setError(
          msg.includes("Speech recognition") || msg.includes("transcription") || msg.includes("Whisper")
            ? "Server speech recognition failed. Use Chrome or Edge for live captions, or fix local Whisper (see docs/INSTALLATION.md)."
            : msg,
        );
      } finally {
        setAnalyzing(false);
        setAnalysisStatus(null);
      }
    },
    [announceStep],
  );

  const finishRecording = React.useCallback(async () => {
    clearMaxDuration();
    try {
      const [blob, browserTranscript] = await Promise.all([stopRecording(), browserStt.stop()]);

      if (step === "q1_city") {
        appendEarlyTranscript(browserTranscript);
        saveSegment(blob, browserTranscript, "q2_duration");
        return;
      }
      if (step === "q2_duration") {
        appendEarlyTranscript(browserTranscript);
        saveSegment(blob, browserTranscript, "q3_about_city");
        return;
      }
      if (step === "q3_about_city") {
        setAnalysisBlobs((prev) => [...prev, blob]);
        await scoreMidpointFromQ3(browserTranscript, blob);
        return;
      }
      if (step === "q4_objects") {
        setAnalysisBlobs((prev) => [...prev, blob]);
        setError(null);
        goNextAfterQuestion("q5_visual");
        return;
      }
      if (step === "q5_visual") {
        const blobsForAnalysis = [...analysisBlobs, blob];
        setAnalysisBlobs(blobsForAnalysis);
        const prefix = earlyTranscriptParts.join("\n\n");
        await runFullAnalysis(blobsForAnalysis, prefix);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish recording.");
      setAnalyzing(false);
      setAnalysisStatus(null);
    }
  }, [
    analysisBlobs,
    appendEarlyTranscript,
    browserStt,
    clearMaxDuration,
    earlyTranscriptParts,
    goNextAfterQuestion,
    runFullAnalysis,
    saveSegment,
    scoreMidpointFromQ3,
    step,
    stopRecording,
  ]);

  const onToggleRecord = React.useCallback(() => {
    if (analyzing) return;
    if (recordingRef.current) {
      void finishRecording();
      return;
    }
    setError(null);
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

  const scoresForDisplay =
    midpointScores && (step === "midpoint" || (showContact && !fullPath)) ? midpointScores : displayScores;

  const stepProgress = STEP_PROGRESS[step];
  const coachSpeaking = speaking && step !== "welcome";
  const welcomeLinesActive = mounted && (speaking || welcomeReady);

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-background px-6 py-10">
      <DemoAmbient />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-8">
        <div className="flex w-full items-center justify-between gap-4">
          <AuravoMark className="h-9 max-w-[160px] opacity-95" />
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Live demo
          </span>
        </div>

        {stepProgress ? (
          <div className="flex w-full max-w-md items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-500"
                style={{ width: `${(stepProgress.current / stepProgress.total) * 100}%` }}
              />
            </div>
            <p className="shrink-0 text-xs font-medium text-muted-foreground">
              {stepProgress.current}/{stepProgress.total}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {step === "welcome" ? (
          <div className="flex w-full flex-col items-center gap-10 py-6">
            <VoiceOrb mode={speaking ? "speaking" : "idle"} />

            <div className="flex w-full max-w-lg flex-col items-center gap-3">
              {WELCOME_LINES.map((line, i) => (
                <WelcomeLine key={line} text={line} delay={i * 0.18} active={welcomeLinesActive} />
              ))}
            </div>

            {clientHints?.showSttWarning ? (
              <p className="max-w-sm text-center text-xs text-amber-200/90">
                Chrome or Edge recommended for live captions while you speak.
              </p>
            ) : null}

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                variant="glow"
                className="min-w-[11rem]"
                onClick={() => {
                  stopSpeaking();
                  setWelcomeReady(true);
                  spokeRef.current = null;
                  setStep("q1_city");
                }}
              >
                {welcomeReady ? "Start speaking" : "Continue"}
              </Button>
              {mounted && speaking && !welcomeReady ? (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    stopSpeaking();
                    setWelcomeReady(true);
                  }}
                >
                  Skip intro
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "q1_city" ? (
          <QuestionStep
            stepLabel={`Question ${STEP_PROGRESS.q1_city.current}`}
            spokenPrompt={QUESTIONS.q1_city}
            coachSpeaking={coachSpeaking}
            recording={recording}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "q2_duration" ? (
          <QuestionStep
            stepLabel={`Question ${STEP_PROGRESS.q2_duration.current}`}
            spokenPrompt={QUESTIONS.q2_duration}
            coachSpeaking={coachSpeaking}
            recording={recording}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "q3_about_city" ? (
          <QuestionStep
            stepLabel={`Question ${STEP_PROGRESS.q3_about_city.current}`}
            spokenPrompt={QUESTIONS.q3_about_city}
            coachSpeaking={coachSpeaking}
            recording={recording}
            analyzing={analyzing}
            analysisStatus={analysisStatus}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "midpoint" ? (
          <div className="flex w-full flex-col items-center gap-8">
            <VoiceOrb mode={coachSpeaking ? "speaking" : "idle"} />
            <SpokenCaption text={caption ?? QUESTIONS.midpoint} hint="Checkpoint" />
            <RadarSnapshot
              scores={scoresForDisplay}
              caption="Your snapshot so far — from your city description."
              className="rounded-3xl border border-white/10 bg-card/30 p-6 backdrop-blur-md"
            />
            {!showContact ? (
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="glow"
                  disabled={coachSpeaking}
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
                  disabled={coachSpeaking}
                  onClick={() => {
                    void speak(QUESTIONS.thank_you_no);
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
                  void speak(QUESTIONS.thank_you_submit);
                  setStep("thank_you");
                }}
              />
            )}
          </div>
        ) : null}

        {step === "q4_objects" ? (
          <QuestionStep
            stepLabel={`Question ${STEP_PROGRESS.q4_objects.current}`}
            spokenPrompt={QUESTIONS.q4_objects}
            coachSpeaking={coachSpeaking}
            recording={recording}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "q5_visual" ? (
          <QuestionStep
            stepLabel={`Question ${STEP_PROGRESS.q5_visual.current}`}
            spokenPrompt={QUESTIONS.q5_visual}
            coachSpeaking={coachSpeaking}
            recording={recording}
            analyzing={analyzing}
            analysisStatus={analysisStatus}
            onToggleRecord={onToggleRecord}
          >
            <VisualPromptScene className="mx-auto w-full max-w-[300px] rounded-2xl border border-white/15 shadow-xl" />
          </QuestionStep>
        ) : null}

        {step === "results" ? (
          <div className="flex w-full flex-col items-center gap-8">
            <VoiceOrb mode={analyzing ? "thinking" : coachSpeaking ? "speaking" : "idle"} />
            <SpokenCaption
              text={analyzing ? analysisStatus : caption ?? "Your English snapshot"}
              hint={analyzing ? "Analyzing" : "Results"}
            />
            {analyzing ? null : (
              <>
                <RadarSnapshot
                  scores={displayScores}
                  className="rounded-3xl border border-white/10 bg-card/30 p-6 backdrop-blur-md"
                />
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
                      void speak(QUESTIONS.thank_you_submit);
                      setStep("thank_you");
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {step === "thank_you" ? (
          <div className="flex flex-col items-center gap-8 py-6">
            <VoiceOrb mode={coachSpeaking ? "speaking" : "idle"} />
            <SpokenCaption text={caption ?? QUESTIONS.thank_you_page} hint="Thank you" />
            <Button variant="outline" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
