"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VisualPromptScene } from "@/app/(app)/assessment/visual-prompt-scene";
import type {
  QuickAnalysisTranscriptSegment,
  QuickAnalysisWordConfidence,
} from "@/app/quick-analysis/pronunciation-types";
import type { VocabularySuggestion } from "@/lib/analysis/vocabulary-analysis";
import type { AcousticCoachingPattern, CoachingPattern } from "@/lib/coach/transcript-analysis";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { QuickAnalysisPaywall } from "./components/QuickAnalysisPaywall";
import { AnalysisResultsLayout } from "./components/AnalysisResultsLayout";
import { DemoAmbient } from "./components/DemoAmbient";
import { QuestionStep } from "./components/QuestionStep";
import { SpokenCaption } from "./components/SpokenCaption";
import { VoiceOrb } from "./components/VoiceOrb";
import { WelcomeLine } from "./components/WelcomeLine";
import { displayWordConfidencesWithPolishedTranscript } from "@/app/quick-analysis/lib/polished-word-display";
import type { PronunciationHighlightSource } from "@/app/quick-analysis/lib/word-highlight";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { ensureSegmentWordHighlights } from "@/lib/quick-analysis/word-confidences";
import { validateSpokenAnswer } from "@/lib/quick-analysis/validate-spoken-answer";
import { warningInlineClass } from "@/lib/ui/warning-styles";
import { cn } from "@/lib/utils";
import type { QuickAnalysisGrammarSnapshot } from "@/lib/quick-analysis/grammar-snapshot";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";
import {
  QUICK_ANALYSIS_BUSY_MESSAGE,
  QUICK_ANALYSIS_SESSION_MAX_RECORDING_MS,
} from "@/lib/quick-analysis/constants";
import {
  ANALYSIS_QUESTION_KEYS,
  Q1_ANSWER_STARTERS,
  QUESTION_SEGMENT_LABELS,
  QUESTIONS,
  STEP_PROGRESS,
  stepProgressLabel,
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
  sessionId?: string;
  baselineSaved?: boolean;
  scores: SixDimensionScores;
  transcript: string;
  transcriptSegments: QuickAnalysisTranscriptSegment[];
  wordConfidences: QuickAnalysisWordConfidence[];
  phoneticMap: Record<string, string>;
  pronunciationHighlightSource?: PronunciationHighlightSource;
  grammar: QuickAnalysisGrammarSnapshot;
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

function analysisErrorMessage(data: Record<string, unknown>, fallback: string): string {
  if (data.code === "SERVER_BUSY") return QUICK_ANALYSIS_BUSY_MESSAGE;
  return typeof data.error === "string" ? data.error : fallback;
}

async function refreshUsage(): Promise<{
  usage: QuickAnalysisUsageSnapshot;
  razorpayKeyId: string | null;
}> {
  const res = await fetch("/api/quick-analysis/usage");
  const data = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not load usage.");
  }
  return {
    usage: data.usage as QuickAnalysisUsageSnapshot,
    razorpayKeyId: typeof data.razorpayKeyId === "string" ? data.razorpayKeyId : null,
  };
}

async function reserveAssessmentSlot(): Promise<QuickAnalysisUsageSnapshot> {
  const res = await fetch("/api/quick-analysis/start", { method: "POST" });
  const data = await readJsonResponse(res);
  if (res.status === 402) {
    const err = new Error(
      typeof data.error === "string" ? data.error : "Daily limit reached.",
    ) as Error & { code?: string };
    err.code = "PAYWALL_REQUIRED";
    throw err;
  }
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not start assessment.");
  }
  return data.usage as QuickAnalysisUsageSnapshot;
}

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
    if (!res.ok) {
      if (data.code === "SERVER_BUSY") throw new Error(QUICK_ANALYSIS_BUSY_MESSAGE);
      return null;
    }
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
  if (!res.ok) throw new Error(analysisErrorMessage(data, "Scoring failed"));
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

function enrichTranscriptSegments(
  segments: QuickAnalysisTranscriptSegment[],
  allWords: QuickAnalysisWordConfidence[],
): QuickAnalysisTranscriptSegment[] {
  if (segments.length === 0) return segments;

  let enriched =
    allWords.length > 0 ? ensureSegmentWordHighlights(segments, allWords) : segments;

  return enriched.map((segment) => ({
    ...segment,
    wordConfidences: displayWordConfidencesWithPolishedTranscript(
      segment.wordConfidences,
      segment.transcript,
    ),
  }));
}

async function fetchPolishedSegments(
  segments: QuickAnalysisTranscriptSegment[],
): Promise<QuickAnalysisTranscriptSegment[] | null> {
  if (segments.length === 0) return null;
  try {
    const res = await fetch("/api/quick-analysis/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "polish-segments", segments }),
    });
    const data = await readJsonResponse(res);
    if (!res.ok || !Array.isArray(data.segments)) return null;
    return data.segments as QuickAnalysisTranscriptSegment[];
  } catch {
    return null;
  }
}

function mergePolishedSegments(
  original: QuickAnalysisTranscriptSegment[],
  polished: QuickAnalysisTranscriptSegment[],
): QuickAnalysisTranscriptSegment[] {
  return original.map((seg, i) => {
    const next = polished[i];
    if (!next?.transcript.trim()) return seg;
    return {
      ...seg,
      transcript: next.transcript,
      wordConfidences: displayWordConfidencesWithPolishedTranscript(
        seg.wordConfidences,
        next.transcript,
      ),
    };
  });
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
  goalId?: string | null,
): Promise<FullAnalysisResponse> {
  const form = new FormData();
  form.append("mode", "full");
  if (goalId) form.append("goalId", goalId);
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
    throw new Error(analysisErrorMessage(data, "Full analysis failed"));
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

type QuickAnalysisFlowProps = {
  goalId?: string | null;
};

export function QuickAnalysisFlow({ goalId = null }: QuickAnalysisFlowProps) {
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
  const [pronunciationHighlightSource, setPronunciationHighlightSource] =
    React.useState<PronunciationHighlightSource>("groq");
  const [grammarFeedback, setGrammarFeedback] = React.useState<QuickAnalysisGrammarSnapshot | null>(
    null,
  );
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysisStatus, setAnalysisStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fullPath, setFullPath] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [usage, setUsage] = React.useState<QuickAnalysisUsageSnapshot | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = React.useState<string | null>(null);
  const [showPaywall, setShowPaywall] = React.useState(false);
  const [startingSession, setStartingSession] = React.useState(false);
  const [midpointDone, setMidpointDone] = React.useState(false);
  const [baselineSessionId, setBaselineSessionId] = React.useState<string | null>(null);
  const [sessionRecordingMs, setSessionRecordingMs] = React.useState(0);
  /** Browser-only STT hint — rendered after mount to avoid hydration mismatch. */
  const [clientHints, setClientHints] = React.useState<{
    showSttWarning: boolean;
  } | null>(null);

  const maxDurationRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokeRef = React.useRef<string | null>(null);
  const recordingRef = React.useRef(false);
  const welcomeStartedRef = React.useRef(false);
  const sessionReservedRef = React.useRef(false);
  const totalRecordingMsRef = React.useRef(0);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const browserSttRef = React.useRef(browserStt);
  browserSttRef.current = browserStt;
  /** Sync refs so midpoint loader sees Q3 before React state commits. */
  const analysisBlobsRef = React.useRef<Blob[]>([]);
  const analysisSegmentTranscriptsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    analysisBlobsRef.current = analysisBlobs;
    analysisSegmentTranscriptsRef.current = analysisSegmentTranscripts;
  }, [analysisBlobs, analysisSegmentTranscripts]);

  const syncAnalysisClips = React.useCallback((blobs: Blob[], transcripts: string[]) => {
    analysisBlobsRef.current = blobs;
    analysisSegmentTranscriptsRef.current = transcripts;
    setAnalysisBlobs(blobs);
    setAnalysisSegmentTranscripts(transcripts);
  }, []);

  React.useEffect(() => {
    setMounted(true);
    setClientHints({ showSttWarning: !browserStt.supported });
    void refreshUsage()
      .then(({ usage: nextUsage, razorpayKeyId: keyId }) => {
        setUsage(nextUsage);
        setRazorpayKeyId(keyId);
        if (!nextUsage.canStart) setShowPaywall(true);
      })
      .catch(() => {
        /* usage banner is optional */
      });
  }, [browserStt.supported]);

  const beginAssessmentSession = React.useCallback(async () => {
    if (sessionReservedRef.current) return true;
    setStartingSession(true);
    setError(null);
    try {
      const nextUsage = await reserveAssessmentSlot();
      sessionReservedRef.current = true;
      totalRecordingMsRef.current = 0;
      setUsage(nextUsage);
      setShowPaywall(false);
      return true;
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "PAYWALL_REQUIRED") {
        setShowPaywall(true);
        void refreshUsage().then(({ usage: nextUsage, razorpayKeyId: keyId }) => {
          setUsage(nextUsage);
          setRazorpayKeyId(keyId);
        });
        return false;
      }
      setError(e instanceof Error ? e.message : "Could not start assessment.");
      return false;
    } finally {
      setStartingSession(false);
    }
  }, []);

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

  const applyTranscriptSegments = React.useCallback(
    (
      segments: QuickAnalysisTranscriptSegment[],
      options?: {
        skipPolish?: boolean;
        allWords?: QuickAnalysisWordConfidence[];
        phoneticMap?: Record<string, string>;
      },
    ) => {
      const enriched = enrichTranscriptSegments(segments, options?.allWords ?? []);
      const filtered = enriched.filter(
        (s) => s.transcript.length > 0 || s.wordConfidences.length > 0,
      );
      setTranscriptSegments(filtered);
      const allWords = filtered.flatMap((s) => s.wordConfidences);
      setWordConfidences(allWords);

      if (options?.phoneticMap !== undefined) {
        setPhoneticMap(options.phoneticMap);
      } else if (allWords.length > 0) {
        void fetchPhoneticMap(allWords).then(setPhoneticMap);
      }

      if (options?.skipPolish) return;
      void fetchPolishedSegments(filtered).then((polished) => {
        if (!polished?.length) return;
        const merged = mergePolishedSegments(filtered, polished);
        const mergedEnriched = enrichTranscriptSegments(merged, options?.allWords ?? allWords);
        setTranscriptSegments(mergedEnriched);
        setWordConfidences(mergedEnriched.flatMap((s) => s.wordConfidences));
      });
    },
    [],
  );

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
          void segmentPromise;
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
    [browserStt.supported, ensureSegmentPrefetch, goNextAfterQuestion],
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
          goalId,
        );
        setDisplayScores(result.scores);
        setCoachSummary(result.coachSummary);
        applyTranscriptSegments(result.transcriptSegments ?? [], {
          skipPolish: true,
          allWords: result.wordConfidences ?? [],
          phoneticMap: result.phoneticMap ?? {},
        });
        setPronunciationHighlightSource(result.pronunciationHighlightSource ?? "groq");
        setGrammarFeedback(result.grammar ?? null);
        if (typeof result.sessionId === "string") setBaselineSessionId(result.sessionId);
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
    [announceStep, applyTranscriptSegments, goalId],
  );

  const finishRecording = React.useCallback(async () => {
    clearMaxDuration();
    const clipRecordingMs =
      recordingStartedAtRef.current != null
        ? Date.now() - recordingStartedAtRef.current
        : 0;
    if (recordingStartedAtRef.current != null) {
      totalRecordingMsRef.current += clipRecordingMs;
      recordingStartedAtRef.current = null;
      setSessionRecordingMs(totalRecordingMsRef.current);
    }
    try {
      const [blob, browserTranscript] = await Promise.all([stopRecording(), browserStt.stop()]);

      const spokenError = validateSpokenAnswer(blob, browserTranscript, clipRecordingMs);
      if (spokenError) {
        totalRecordingMsRef.current = Math.max(0, totalRecordingMsRef.current - clipRecordingMs);
        setSessionRecordingMs(totalRecordingMsRef.current);
        setError(spokenError);
        return;
      }

      if (step === "q1_city") {
        const q1Index = analysisBlobsRef.current.length;
        const nextBlobs = [...analysisBlobsRef.current, blob];
        const nextTranscripts = [...analysisSegmentTranscriptsRef.current, browserTranscript.trim()];
        syncAnalysisClips(nextBlobs, nextTranscripts);
        warmSegmentTranscription(q1Index, blob, browserTranscript.trim());
        setError(null);
        goNextAfterQuestion("q2_duration");
        return;
      }
      if (step === "q2_duration") {
        const q2Index = analysisBlobsRef.current.length;
        const nextBlobs = [...analysisBlobsRef.current, blob];
        const nextTranscripts = [...analysisSegmentTranscriptsRef.current, browserTranscript.trim()];
        syncAnalysisClips(nextBlobs, nextTranscripts);
        warmSegmentTranscription(q2Index, blob, browserTranscript.trim());
        setError(null);
        goNextAfterQuestion("q3_about_city");
        return;
      }
      if (step === "q3_about_city") {
        const q3Index = analysisBlobsRef.current.length;
        const nextBlobs = [...analysisBlobsRef.current, blob];
        const nextTranscripts = [...analysisSegmentTranscriptsRef.current, browserTranscript.trim()];
        syncAnalysisClips(nextBlobs, nextTranscripts);
        warmSegmentTranscription(q3Index, blob, browserTranscript.trim());
        await scoreMidpointFromQ3(q3Index, browserTranscript, blob);
        return;
      }
      if (step === "q4_objects") {
        const q4Index = analysisBlobsRef.current.length;
        const nextBlobs = [...analysisBlobsRef.current, blob];
        const nextTranscripts = [...analysisSegmentTranscriptsRef.current, browserTranscript.trim()];
        syncAnalysisClips(nextBlobs, nextTranscripts);
        warmSegmentTranscription(q4Index, blob, browserTranscript.trim());
        setError(null);
        goNextAfterQuestion("q5_visual");
        return;
      }
      if (step === "q5_visual") {
        const nextBlobs = [...analysisBlobsRef.current, blob];
        const nextTranscripts = [...analysisSegmentTranscriptsRef.current, browserTranscript.trim()];
        syncAnalysisClips(nextBlobs, nextTranscripts);
        const q5Index = nextBlobs.length - 1;
        setError(null);
        setAnalyzing(true);
        setAnalysisStatus("Running full analysis…");
        setStep("results");

        warmSegmentTranscription(q5Index, blob, browserTranscript.trim());

        const prefetched = await Promise.all(
          nextBlobs.map((segmentBlob, i) =>
            ensureSegmentPrefetch(i, segmentBlob, nextTranscripts[i] ?? ""),
          ),
        );
        const serverForAnalysis = prefetched.map((r) => r?.transcript ?? "");
        const metaForAnalysis = prefetched.map((r) => r?.transcriptMetaJson ?? "");

        if (serverForAnalysis.some((t) => !t.trim())) {
          syncAnalysisClips(
            analysisBlobsRef.current.slice(0, -1),
            analysisSegmentTranscriptsRef.current.slice(0, -1),
          );
          setAnalyzing(false);
          setAnalysisStatus(null);
          setStep("q5_visual");
          setError(
            "We couldn't transcribe one of your answers. Please re-record any question where you didn't speak clearly.",
          );
          return;
        }

        await runFullAnalysis(
          nextBlobs,
          nextTranscripts,
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
    ensureSegmentPrefetch,
    browserStt,
    clearMaxDuration,
    goNextAfterQuestion,
    runFullAnalysis,
    warmSegmentTranscription,
    scoreMidpointFromQ3,
    step,
    stopRecording,
    syncAnalysisClips,
  ]);

  const onToggleRecord = React.useCallback(() => {
    unlockFromGesture();
    if (analyzing) return;
    if (recordingRef.current) {
      void finishRecording();
      return;
    }
    const remainingMs = QUICK_ANALYSIS_SESSION_MAX_RECORDING_MS - totalRecordingMsRef.current;
    if (remainingMs <= 0) {
      setError("You've used the full 5-minute session limit for this assessment.");
      return;
    }
    setError(null);
    clearMaxDuration();
    browserStt.start();
    recordingStartedAtRef.current = Date.now();
    void startRecording();
    maxDurationRef.current = setTimeout(() => {
      if (recordingRef.current) void finishRecording();
    }, remainingMs);
  }, [analyzing, browserStt, clearMaxDuration, finishRecording, startRecording, unlockFromGesture]);

  const scoresForDisplay =
    midpointScores && step === "midpoint" && !fullPath ? midpointScores : displayScores;

  const recordingRemainingMs = Math.max(
    0,
    QUICK_ANALYSIS_SESSION_MAX_RECORDING_MS - sessionRecordingMs,
  );
  const recordingRemainingLabel = `${Math.ceil(recordingRemainingMs / 1000)}s left in this session`;

  const stepProgress = STEP_PROGRESS[step];
  const coachSpeaking = speaking && step !== "welcome";
  const welcomeLinesActive = mounted && (speaking || welcomeReady);
  const wideResultsLayout = step === "results" || step === "midpoint";

  if (showPaywall) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-6">
        <QuickAnalysisPaywall
          razorpayKeyId={razorpayKeyId}
          onSubscribed={() => {
            void refreshUsage().then(({ usage: nextUsage, razorpayKeyId: keyId }) => {
              setUsage(nextUsage);
              setRazorpayKeyId(keyId);
              setShowPaywall(false);
            });
          }}
        />
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center overflow-hidden px-1 py-4 sm:px-2">
      <DemoAmbient />

      <div
        className={cn(
          "relative z-10 flex w-full flex-col items-center gap-8",
          wideResultsLayout ? "max-w-6xl px-2 sm:px-4" : "max-w-2xl",
        )}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Quick Analysis</p>
            <p className="text-xs text-muted-foreground">
              {usage?.needsBaseline
                ? "Your initial spoken baseline with Voca"
                : "5-minute voice snapshot with Voca"}
            </p>
          </div>
          {usage ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary">
              {usage.needsBaseline
                ? "Baseline required"
                : usage.isAdmin
                  ? "Admin · unlimited"
                  : usage.subscribed
                    ? "Subscribed"
                    : `${usage.remainingFree} free left today`}
            </span>
          ) : null}
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
              <p className={`max-w-sm text-center text-xs ${warningInlineClass}`}>
                Chrome or Edge recommended for live captions while you speak.
              </p>
            ) : null}

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                variant="glow"
                className="min-w-[11rem]"
                disabled={startingSession}
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
                  void (async () => {
                    const ok = await beginAssessmentSession();
                    if (!ok) return;
                    stopSpeaking();
                    spokeRef.current = null;
                    setStep("q1_city");
                  })();
                }}
              >
                {startingSession
                  ? "Starting…"
                  : welcomeReady
                    ? "Start speaking"
                    : speaking
                      ? "Continue"
                      : "Play intro"}
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

        {step === "q1_city" || step === "q2_duration" || step === "q3_about_city" || step === "q4_objects" || step === "q5_visual" ? (
          <p className="text-xs text-muted-foreground">{recordingRemainingLabel}</p>
        ) : null}

        {step === "q1_city" ? (
          <QuestionStep
            stepLabel={stepProgressLabel("q1_city")}
            spokenPrompt={QUESTIONS.q1_city}
            answerStarters={Q1_ANSWER_STARTERS}
            coachSpeaking={coachSpeaking}
            recording={recording}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "q2_duration" ? (
          <QuestionStep
            stepLabel={stepProgressLabel("q2_duration")}
            spokenPrompt={QUESTIONS.q2_duration}
            coachSpeaking={coachSpeaking}
            recording={recording}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "q3_about_city" ? (
          <QuestionStep
            stepLabel={stepProgressLabel("q3_about_city")}
            spokenPrompt={QUESTIONS.q3_about_city}
            coachSpeaking={coachSpeaking}
            recording={recording}
            analyzing={analyzing}
            analysisStatus={analysisStatus}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "midpoint" ? (
          <>
            {coachSpeaking ? (
              <SpokenCaption text={caption ?? QUESTIONS.midpoint} hint="Checkpoint" className="w-full" />
            ) : null}
            <AnalysisResultsLayout
            scores={scoresForDisplay}
            transcriptSegments={[]}
            phoneticMap={{}}
            showTranscript={false}
            subtitle="Your basic snapshot so far"
            footer={
              !midpointDone ? (
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button
                    variant="glow"
                    disabled={coachSpeaking}
                    onClick={() => {
                      setFullPath(true);
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
                      setMidpointDone(true);
                    }}
                  >
                    No thanks
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center pt-2">
                  <Button variant="glow" asChild>
                    <Link href="/dashboard">Back to Home</Link>
                  </Button>
                </div>
              )
            }
          />
          </>
        ) : null}

        {step === "q4_objects" ? (
          <QuestionStep
            stepLabel={stepProgressLabel("q4_objects")}
            spokenPrompt={QUESTIONS.q4_objects}
            coachSpeaking={coachSpeaking}
            recording={recording}
            onToggleRecord={onToggleRecord}
          />
        ) : null}

        {step === "q5_visual" ? (
          <QuestionStep
            stepLabel={stepProgressLabel("q5_visual")}
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
          <AnalysisResultsLayout
            scores={displayScores}
            transcriptSegments={transcriptSegments}
            sessionWordConfidences={wordConfidences}
            phoneticMap={phoneticMap}
            highlightSource={pronunciationHighlightSource}
            coachSummary={coachSummary}
            grammar={fullPath ? grammarFeedback : null}
            baselineSessionId={baselineSessionId}
            analyzing={analyzing}
            analysisStatus={analysisStatus}
          />
        ) : null}

        {step === "thank_you" ? (
          <div className="flex flex-col items-center gap-8 py-6">
            <VoiceOrb mode={coachSpeaking ? "speaking" : "idle"} />
            <SpokenCaption text={caption ?? QUESTIONS.thank_you_page} hint="Thank you" />
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to Home</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
