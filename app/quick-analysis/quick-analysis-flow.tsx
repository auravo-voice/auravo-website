"use client";

import * as React from "react";
import Link from "next/link";
import { AuravoMark } from "@/components/brand";
import { CoachInsightCards } from "@/components/coach-insight-cards";
import { Button } from "@/components/ui/button";
import { VisualPromptScene } from "@/app/(app)/assessment/visual-prompt-scene";
import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import type { VocabularySuggestion } from "@/lib/analysis/vocabulary-analysis";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { ContactForm } from "./components/ContactForm";
import { PronunciationTranscript } from "./components/PronunciationTranscript";
import { DemoAmbient } from "./components/DemoAmbient";
import { QuestionStep } from "./components/QuestionStep";
import { RadarSnapshot } from "./components/RadarSnapshot";
import { SpokenCaption } from "./components/SpokenCaption";
import { VoiceOrb } from "./components/VoiceOrb";
import { WelcomeLine } from "./components/WelcomeLine";
import { readJsonResponse } from "@/lib/api/read-json-response";
import {
  ANALYSIS_QUESTION_KEYS,
  Q3_ANALYSIS_SEGMENT_INDEX,
  QUESTION_SEGMENT_LABELS,
  QUESTIONS,
  STEP_PROGRESS,
  WELCOME_LINES,
  WELCOME_SPEECH,
} from "./copy";
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
  wordConfidences?: QuickAnalysisWordConfidence[];
  phoneticMap?: Record<string, string>;
};

type FullAnalysisResponse = {
  scores: SixDimensionScores;
  transcript: string;
  transcriptSegments: QuickAnalysisTranscriptSegment[];
  wordConfidences: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
  coachSummary: {
    biggestIssue: string | null;
    strength: string | null;
    patterns: CoachingPattern[];
    acousticPatterns: AcousticCoachingPattern[];
    vocabularySuggestions: VocabularySuggestion[];
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
const FULL_ANALYSIS_TIMEOUT_MS = 300_000;

type SegmentPrefetchResult = {
  transcript: string;
  whispered: boolean;
  wordConfidences: QuickAnalysisWordConfidence[];
  transcriptMetaJson: string | null;
};

const NEXT_STEP: Partial<Record<QuickAnalysisStep, QuickAnalysisStep>> = {
  welcome: "q1_city",
  q1_city: "q2_duration",
  q2_duration: "q3_about_city",
  q3_about_city: "midpoint",
  midpoint: "q4_objects",
  q4_objects: "q5_visual",
};

async function fetchSegmentPrefetch(
  blob: Blob,
  browserTranscript: string,
): Promise<SegmentPrefetchResult | null> {
  try {
    const form = new FormData();
    form.append("mode", "segment");
    form.append("audio", blob, "segment.webm");
    form.append("browserTranscript", browserTranscript);
    const res = await fetch("/api/quick-analysis/analyze", { method: "POST", body: form });
    const data = await readJsonResponse(res);
    if (!res.ok) return null;
    const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
    if (!transcript) return null;
    return {
      transcript,
      whispered: data.whispered === true,
      wordConfidences: Array.isArray(data.wordConfidences)
        ? (data.wordConfidences as QuickAnalysisWordConfidence[])
        : [],
      transcriptMetaJson:
        typeof data.transcriptMetaJson === "string" && data.transcriptMetaJson.length > 0
          ? data.transcriptMetaJson
          : null,
    };
  } catch {
    return null;
  }
}

async function scoreFromTranscript(transcript: string): Promise<DeterministicResponse> {
  const form = new FormData();
  form.append("mode", "transcript");
  form.append("transcript", transcript);
  const res = await fetch("/api/quick-analysis/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(SCORE_TIMEOUT_MS),
  });
  const data = await readJsonResponse(res);
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Scoring failed");
  return data as unknown as DeterministicResponse;
}

async function fetchPhoneticMap(
  wordConfidences: QuickAnalysisWordConfidence[],
): Promise<Record<string, string>> {
  if (wordConfidences.length === 0) return {};
  try {
    const res = await fetch("/api/quick-analysis/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "phonetics", wordConfidences }),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) return {};
    return data.phoneticMap && typeof data.phoneticMap === "object"
      ? (data.phoneticMap as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function segmentLabelForIndex(index: number): string {
  const key = ANALYSIS_QUESTION_KEYS[index];
  return key ? QUESTION_SEGMENT_LABELS[key] : `Question ${index + 1}`;
}

async function analyzeFull(
  blobs: Blob[],
  segmentTranscripts: string[],
  segmentServerTranscripts: string[],
  segmentServerMetaJson: string[],
): Promise<FullAnalysisResponse> {
  const form = new FormData();
  form.append("mode", "full");
  for (const text of segmentTranscripts) {
    form.append("segmentTranscript", text);
  }
  for (const text of segmentServerTranscripts) {
    form.append("segmentServerTranscript", text);
  }
  for (const meta of segmentServerMetaJson) {
    form.append("segmentServerMetaJson", meta);
  }
  for (let i = 0; i < blobs.length; i++) {
    form.append("segmentLabel", segmentLabelForIndex(i));
  }
  for (const blob of blobs) {
    form.append("audio", blob, "segment.webm");
  }
  const res = await fetch("/api/quick-analysis/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(FULL_ANALYSIS_TIMEOUT_MS),
  });
  const data = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Full analysis failed");
  }
  return data as unknown as FullAnalysisResponse;
}

function promptForStep(step: QuickAnalysisStep): string | null {
  if (step === "midpoint") return QUESTIONS.midpoint;
  if (step === "results") return QUESTIONS.results;
  if (step === "thank_you") return QUESTIONS.thank_you_page;
  if (step in QUESTIONS) return QUESTIONS[step as keyof typeof QUESTIONS];
  return null;
}

export function QuickAnalysisFlow() {
  const { speak, stop: stopSpeaking, speaking, caption, unlockFromGesture, prefetchTts } =
    useSpeechSynthesis();
  const { recording, start: startRecording, stop: stopRecording } = useVoiceRecorder();
  const browserStt = useBrowserSpeechRecognition();

  const [step, setStep] = React.useState<QuickAnalysisStep>("welcome");
  const [welcomeReady, setWelcomeReady] = React.useState(false);
  /** Q1–Q5 clips for analysis (audio concat + per-question transcript sections). */
  const [analysisBlobs, setAnalysisBlobs] = React.useState<Blob[]>([]);
  /** Browser STT per Q1–Q5 clip. */
  const [analysisSegmentTranscripts, setAnalysisSegmentTranscripts] = React.useState<string[]>([]);
  const [transcriptSegments, setTranscriptSegments] = React.useState<QuickAnalysisTranscriptSegment[]>(
    [],
  );
  const [midpointScores, setMidpointScores] = React.useState<SixDimensionScores | null>(null);
  const [displayScores, setDisplayScores] = React.useState<SixDimensionScores>(DEFAULT_SCORES);
  const [coachSummary, setCoachSummary] = React.useState<FullAnalysisResponse["coachSummary"] | null>(null);
  const [wordConfidences, setWordConfidences] = React.useState<QuickAnalysisWordConfidence[]>([]);
  const [phoneticMap, setPhoneticMap] = React.useState<Record<string, string>>({});
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

  const startWelcomeSpeech = React.useCallback(() => {
    if (welcomeStartedRef.current) return;
    welcomeStartedRef.current = true;
    setWelcomeReady(false);
    spokeRef.current = "welcome";
    void speak(WELCOME_SPEECH, () => setWelcomeReady(true));
  }, [speak]);

  React.useEffect(() => {
    if (step === "welcome") return;
    if (spokeRef.current === step) return;
    announceStep(step);
  }, [step, announceStep]);

  React.useEffect(() => {
    const next = NEXT_STEP[step];
    if (!next) return;
    const text = promptForStep(next);
    if (text) prefetchTts(text);
  }, [step, prefetchTts]);

  const segmentPrefetchPromisesRef = React.useRef<Map<number, Promise<SegmentPrefetchResult | null>>>(
    new Map(),
  );

  const ensureSegmentPrefetch = React.useCallback(
    (index: number, blob: Blob, browser: string): Promise<SegmentPrefetchResult | null> => {
      const existing = segmentPrefetchPromisesRef.current.get(index);
      if (existing) return existing;
      const promise = fetchSegmentPrefetch(blob, browser);
      segmentPrefetchPromisesRef.current.set(index, promise);
      return promise;
    },
    [],
  );

  const warmSegmentTranscription = React.useCallback(
    (index: number, blob: Blob, browser: string) => {
      void ensureSegmentPrefetch(index, blob, browser);
    },
    [ensureSegmentPrefetch],
  );

  const goNextAfterQuestion = React.useCallback((next: QuickAnalysisStep) => {
    spokeRef.current = null;
    setStep(next);
  }, []);

  const applyTranscriptSegments = React.useCallback((segments: QuickAnalysisTranscriptSegment[]) => {
    const filtered = segments.filter((s) => s.transcript.length > 0 || s.wordConfidences.length > 0);
    setTranscriptSegments(filtered);
    const allWords = filtered.flatMap((s) => s.wordConfidences);
    setWordConfidences(allWords);
    if (allWords.length > 0) {
      void fetchPhoneticMap(allWords).then(setPhoneticMap);
    }
  }, []);

  const loadMidpointTranscriptSegments = React.useCallback(async () => {
    const segments: QuickAnalysisTranscriptSegment[] = [];
    for (let i = 0; i <= Q3_ANALYSIS_SEGMENT_INDEX && i < analysisBlobs.length; i++) {
      const prefetched = await ensureSegmentPrefetch(
        i,
        analysisBlobs[i]!,
        analysisSegmentTranscripts[i] ?? "",
      );
      if (!prefetched?.transcript) continue;
      segments.push({
        label: segmentLabelForIndex(i),
        transcript: prefetched.transcript,
        wordConfidences: prefetched.wordConfidences,
      });
    }
    applyTranscriptSegments(segments);
  }, [
    analysisBlobs,
    analysisSegmentTranscripts,
    applyTranscriptSegments,
    ensureSegmentPrefetch,
  ]);

  const scoreMidpointFromQ3 = React.useCallback(
    async (q3Index: number, q3Transcript: string, q3Blob: Blob) => {
      setAnalyzing(true);
      setAnalysisStatus("Building your snapshot…");
      setError(null);
      try {
        const trimmed = q3Transcript.trim();
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        if (wordCount < 1 && !browserStt.supported) {
          throw new Error(
            "We could not hear a transcript from your browser. Use Chrome or Edge for live captions, or run npm run setup:transcription (Python 3.11 or 3.12) for server speech recognition.",
          );
        }
        const segmentPromise = ensureSegmentPrefetch(q3Index, q3Blob, trimmed);
        if (wordCount >= 1) {
          const scoreResult = await scoreFromTranscript(trimmed);
          setMidpointScores(scoreResult.scores);
          setDisplayScores(scoreResult.scores);
          setAnalyzing(false);
          setAnalysisStatus(null);
          goNextAfterQuestion("midpoint");
          void segmentPromise.then((result) => {
            if (!result?.transcript) return;
            applyTranscriptSegments([
              {
                label: segmentLabelForIndex(q3Index),
                transcript: result.transcript,
                wordConfidences: result.wordConfidences,
              },
            ]);
          });
        } else {
          const segmentResult = await segmentPromise;
          if (!segmentResult?.transcript) {
            throw new Error(
              "We could not transcribe your answer. Try again in a quiet room, or use Chrome or Edge for live captions.",
            );
          }
          const scoreResult = await scoreFromTranscript(segmentResult.transcript);
          setMidpointScores(scoreResult.scores);
          setDisplayScores(scoreResult.scores);
          applyTranscriptSegments([
            {
              label: segmentLabelForIndex(q3Index),
              transcript: segmentResult.transcript,
              wordConfidences: segmentResult.wordConfidences,
            },
          ]);
          goNextAfterQuestion("midpoint");
        }
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
    [applyTranscriptSegments, browserStt.supported, ensureSegmentPrefetch, goNextAfterQuestion],
  );

  const runFullAnalysis = React.useCallback(
    async (
      blobs: Blob[],
      segmentTranscripts: string[],
      serverTranscripts: string[],
      serverMetaJson: string[],
    ) => {
      setAnalyzing(true);
      setAnalysisStatus("Running full analysis…");
      setError(null);
      try {
        const result = await analyzeFull(
          blobs,
          segmentTranscripts,
          serverTranscripts,
          serverMetaJson,
        );
        setDisplayScores(result.scores);
        setCoachSummary(result.coachSummary);
        applyTranscriptSegments(result.transcriptSegments ?? []);
        setPhoneticMap(result.phoneticMap ?? {});
        setShowContact(true);
        setFullPath(true);
        setStep("results");
        announceStep("results");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Full analysis failed.";
        const timedOut =
          e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
        setError(
          timedOut || msg.includes("took too long")
            ? "Full analysis timed out. Try again on Chrome or Edge with a stable connection, or stop after the checkpoint for a quicker snapshot."
            : msg.includes("Speech recognition") || msg.includes("transcription") || msg.includes("Whisper")
              ? "Server speech recognition failed. Use Chrome or Edge for live captions, or fix local Whisper (see docs/INSTALLATION.md)."
              : msg,
        );
      } finally {
        setAnalyzing(false);
        setAnalysisStatus(null);
      }
    },
    [announceStep, applyTranscriptSegments],
  );

  const finishRecording = React.useCallback(async () => {
    clearMaxDuration();
    try {
      const [blob, browserTranscript] = await Promise.all([stopRecording(), browserStt.stop()]);

      if (step === "q1_city") {
        const q1Index = analysisBlobs.length;
        setAnalysisBlobs((prev) => [...prev, blob]);
        setAnalysisSegmentTranscripts((prev) => [...prev, browserTranscript.trim()]);
        warmSegmentTranscription(q1Index, blob, browserTranscript.trim());
        setError(null);
        goNextAfterQuestion("q2_duration");
        return;
      }
      if (step === "q2_duration") {
        const q2Index = analysisBlobs.length;
        setAnalysisBlobs((prev) => [...prev, blob]);
        setAnalysisSegmentTranscripts((prev) => [...prev, browserTranscript.trim()]);
        warmSegmentTranscription(q2Index, blob, browserTranscript.trim());
        setError(null);
        goNextAfterQuestion("q3_about_city");
        return;
      }
      if (step === "q3_about_city") {
        const q3Index = Q3_ANALYSIS_SEGMENT_INDEX;
        setAnalysisBlobs((prev) => [...prev, blob]);
        setAnalysisSegmentTranscripts((prev) => [...prev, browserTranscript.trim()]);
        warmSegmentTranscription(q3Index, blob, browserTranscript.trim());
        await scoreMidpointFromQ3(q3Index, browserTranscript, blob);
        return;
      }
      if (step === "q4_objects") {
        const q4Index = analysisBlobs.length;
        setAnalysisBlobs((prev) => [...prev, blob]);
        setAnalysisSegmentTranscripts((prev) => [...prev, browserTranscript.trim()]);
        warmSegmentTranscription(q4Index, blob, browserTranscript.trim());
        setError(null);
        goNextAfterQuestion("q5_visual");
        return;
      }
      if (step === "q5_visual") {
        const transcriptsForAnalysis = [...analysisSegmentTranscripts, browserTranscript.trim()];
        const blobsForAnalysis = [...analysisBlobs, blob];
        const q5Index = blobsForAnalysis.length - 1;
        setAnalysisBlobs(blobsForAnalysis);
        setAnalysisSegmentTranscripts(transcriptsForAnalysis);
        setError(null);
        setAnalyzing(true);
        setAnalysisStatus("Running full analysis…");
        setStep("results");

        warmSegmentTranscription(q5Index, blob, browserTranscript.trim());

        const prefetched = await Promise.all(
          blobsForAnalysis.map((segmentBlob, i) =>
            ensureSegmentPrefetch(i, segmentBlob, transcriptsForAnalysis[i] ?? ""),
          ),
        );
        const serverForAnalysis = prefetched.map((r) => r?.transcript ?? "");
        const metaForAnalysis = prefetched.map((r) => r?.transcriptMetaJson ?? "");

        await runFullAnalysis(
          blobsForAnalysis,
          transcriptsForAnalysis,
          serverForAnalysis,
          metaForAnalysis,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish recording.");
      setAnalyzing(false);
      setAnalysisStatus(null);
    }
  }, [
    analysisBlobs,
    analysisSegmentTranscripts,
    ensureSegmentPrefetch,
    browserStt,
    clearMaxDuration,
    goNextAfterQuestion,
    runFullAnalysis,
    warmSegmentTranscription,
    scoreMidpointFromQ3,
    step,
    stopRecording,
  ]);

  const onToggleRecord = React.useCallback(() => {
    unlockFromGesture();
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
  }, [analyzing, browserStt, clearMaxDuration, finishRecording, startRecording, step, unlockFromGesture]);

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
                  unlockFromGesture();
                  if (!welcomeReady) {
                    if (!welcomeStartedRef.current) {
                      startWelcomeSpeech();
                      return;
                    }
                    stopSpeaking();
                    setWelcomeReady(true);
                    return;
                  }
                  stopSpeaking();
                  spokeRef.current = null;
                  setStep("q1_city");
                }}
              >
                {welcomeReady ? "Start speaking" : speaking ? "Continue" : "Play intro"}
              </Button>
              {mounted && speaking && !welcomeReady ? (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    unlockFromGesture();
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
                    void loadMidpointTranscriptSegments();
                  }}
                >
                  No thanks
                </Button>
              </div>
            ) : (
              <>
                {transcriptSegments.length > 0 ? (
                  <PronunciationTranscript
                    segments={transcriptSegments}
                    phoneticMap={phoneticMap}
                    className="w-full"
                  />
                ) : null}
                <ContactForm
                  scores={scoresForDisplay}
                  onSuccess={() => {
                    void speak(QUESTIONS.thank_you_submit);
                    setStep("thank_you");
                  }}
                />
              </>
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
                {transcriptSegments.length > 0 ? (
                  <PronunciationTranscript
                    segments={transcriptSegments}
                    phoneticMap={phoneticMap}
                    className="w-full"
                  />
                ) : null}
                {coachSummary ? (
                  <div className="w-full">
                    <CoachInsightCards
                      biggestIssue={coachSummary.biggestIssue}
                      strength={coachSummary.strength}
                      patterns={coachSummary.patterns}
                      acousticPatterns={coachSummary.acousticPatterns}
                      vocabularySuggestions={coachSummary.vocabularySuggestions}
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
