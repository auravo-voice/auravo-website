import { NextResponse } from "next/server";

import type { QuickAnalysisWordConfidence } from "@/app/quick-analysis/pronunciation-types";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { runDeterministicQuickAnalysis } from "@/lib/quick-analysis/deterministic-analysis";
import { getPhoneticPronunciations } from "@/lib/quick-analysis/phonetic-analysis";
import { transcribeQuickAnalysisSegment } from "@/lib/quick-analysis/prepare-analysis-segment";
import { runQuickAnalysisFull } from "@/lib/quick-analysis/run-full-analysis";
import { scoreQuickAnalysisFromTranscript } from "@/lib/quick-analysis/score-from-transcript";
import { flaggedWordsForPhonetics } from "@/lib/quick-analysis/word-confidences";
import { TranscriptionUnavailableError } from "@/lib/transcription";
import {
  QuickAnalysisBusyError,
  withQuickAnalysisConcurrency,
} from "@/lib/quick-analysis/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseWordConfidences(raw: unknown): QuickAnalysisWordConfidence[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (w): w is QuickAnalysisWordConfidence =>
      w != null &&
      typeof w === "object" &&
      typeof (w as QuickAnalysisWordConfidence).word === "string" &&
      typeof (w as QuickAnalysisWordConfidence).confidence === "number",
  );
}

function busyResponse() {
  return NextResponse.json(
    {
      error: new QuickAnalysisBusyError().message,
      code: "SERVER_BUSY",
    },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let json: { mode?: string; wordConfidences?: unknown };
    try {
      json = (await req.json()) as { mode?: string; wordConfidences?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (json.mode === "phonetics") {
      try {
        const wordConfidences = parseWordConfidences(json.wordConfidences);
        const phoneticMap = await withQuickAnalysisConcurrency(() =>
          getPhoneticPronunciations(flaggedWordsForPhonetics(wordConfidences)),
        );
        return NextResponse.json({ phoneticMap });
      } catch (e) {
        if (e instanceof QuickAnalysisBusyError) return busyResponse();
        throw e;
      }
    }
    return NextResponse.json({ error: "Invalid JSON mode. Use phonetics." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const modeRaw = form.get("mode");
  const mode = typeof modeRaw === "string" ? modeRaw.trim() : "";

  if (mode === "transcript") {
    const transcriptRaw = form.get("transcript");
    const transcript = typeof transcriptRaw === "string" ? transcriptRaw.trim() : "";
    try {
      const result = await withQuickAnalysisConcurrency(() =>
        Promise.resolve(scoreQuickAnalysisFromTranscript(transcript)),
      );
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof QuickAnalysisBusyError) return busyResponse();
      const msg = e instanceof Error ? e.message : "Scoring failed.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  }

  if (mode === "deterministic") {
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size < 1) {
      return NextResponse.json({ error: "Audio is required." }, { status: 400 });
    }
    try {
      const result = await withQuickAnalysisConcurrency(() => runDeterministicQuickAnalysis(audio));
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof QuickAnalysisBusyError) return busyResponse();
      if (e instanceof TranscriptionUnavailableError) {
        console.error("[quick-analysis/analyze] deterministic transcription failed:", e.cause ?? e.message);
        return NextResponse.json(
          { error: e.message || "Speech recognition is unavailable on the server." },
          { status: 503 },
        );
      }
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  }

  if (mode === "segment") {
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size < 1) {
      return NextResponse.json({ error: "Audio is required." }, { status: 400 });
    }
    const browserRaw = form.get("browserTranscript");
    const browserTranscript = typeof browserRaw === "string" ? browserRaw.trim() : "";
    const startedAt = Date.now();
    try {
      const result = await withQuickAnalysisConcurrency(() =>
        transcribeQuickAnalysisSegment(audio, browserTranscript),
      );
      console.info("[quick-analysis/analyze] segment ok", {
        ms: Date.now() - startedAt,
        whispered: result.whispered,
        chars: result.transcript.length,
        wordCount: result.wordConfidences.length,
        hasMeta: Boolean(result.transcriptMetaJson),
      });
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof QuickAnalysisBusyError) return busyResponse();
      if (e instanceof TranscriptionUnavailableError) {
        return NextResponse.json(
          { error: e.message || "Speech recognition is unavailable on the server." },
          { status: 503 },
        );
      }
      const msg = e instanceof Error ? e.message : "Segment transcription failed.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  }

  if (mode === "full") {
    const blobs = form
      .getAll("audio")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (blobs.length < 1) {
      return NextResponse.json({ error: "At least one audio clip is required." }, { status: 400 });
    }

    const segmentTranscripts = form
      .getAll("segmentTranscript")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""));
    const segmentServerTranscripts = form
      .getAll("segmentServerTranscript")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""));
    const segmentServerMetaJson = form
      .getAll("segmentServerMetaJson")
      .map((entry) => (typeof entry === "string" ? entry : ""));
    const segmentLabels = form
      .getAll("segmentLabel")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""));

    const startedAt = Date.now();
    console.info("[quick-analysis/analyze] full mode started", {
      clips: blobs.length,
      browserSegments: segmentTranscripts.filter((t) => t.length > 0).length,
      prefetchedSegments: segmentServerTranscripts.filter((t) => t.length > 0).length,
      prefetchedMeta: segmentServerMetaJson.filter((m) => m.length > 0).length,
    });
    try {
      const result = await withQuickAnalysisConcurrency(() =>
        runQuickAnalysisFull(
          blobs,
          segmentTranscripts,
          segmentServerTranscripts,
          segmentServerMetaJson,
          segmentLabels,
        ),
      );
      console.info("[quick-analysis/analyze] full mode ok", {
        ms: Date.now() - startedAt,
        transcriptChars: result.transcript.length,
        segmentCount: result.transcriptSegments.length,
        wordCount: result.wordConfidences.length,
      });
      return NextResponse.json({
        scores: result.scores,
        transcript: result.transcript,
        transcriptSegments: result.transcriptSegments,
        wordConfidences: result.wordConfidences,
        phoneticMap: result.phoneticMap,
        coachSummary: {
          biggestIssue: result.coachSummary.biggestIssue,
          strength: result.coachSummary.strength,
          patterns: result.coachSummary.patterns,
          acousticPatterns: result.coachSummary.acousticPatterns,
          vocabularySuggestions: result.coachSummary.vocabularySuggestions ?? [],
          summary: result.coachSummary.summary,
          strengths: result.coachSummary.strengths,
          improvementAreas: result.coachSummary.improvementAreas,
        },
      });
    } catch (e) {
      console.error("[quick-analysis/analyze] full mode failed", {
        ms: Date.now() - startedAt,
        error: e,
      });
      if (e instanceof QuickAnalysisBusyError) return busyResponse();
      if (e instanceof TranscriptionUnavailableError) {
        console.error("[quick-analysis/analyze] full transcription failed:", e.cause ?? e.message);
        return NextResponse.json(
          { error: e.message || "Speech recognition is unavailable on the server." },
          { status: 503 },
        );
      }
      console.error("[quick-analysis/analyze] full mode failed:", e);
      const msg = e instanceof Error ? e.message : "Full analysis failed.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Invalid mode. Use transcript, deterministic, segment, full, or JSON phonetics." },
    { status: 400 },
  );
}
