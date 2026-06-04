import { NextResponse } from "next/server";

import { runDeterministicQuickAnalysis } from "@/lib/quick-analysis/deterministic-analysis";
import { transcribeQuickAnalysisSegment } from "@/lib/quick-analysis/prepare-analysis-segment";
import { runQuickAnalysisFull } from "@/lib/quick-analysis/run-full-analysis";
import { scoreQuickAnalysisFromTranscript } from "@/lib/quick-analysis/score-from-transcript";
import { TranscriptionUnavailableError } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
      const result = scoreQuickAnalysisFromTranscript(transcript);
      return NextResponse.json(result);
    } catch (e) {
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
      const result = await runDeterministicQuickAnalysis(audio);
      return NextResponse.json(result);
    } catch (e) {
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
      const result = await transcribeQuickAnalysisSegment(audio, browserTranscript);
      console.info("[quick-analysis/analyze] segment ok", {
        ms: Date.now() - startedAt,
        whispered: result.whispered,
        chars: result.transcript.length,
      });
      return NextResponse.json(result);
    } catch (e) {
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

    const prefixRaw = form.get("transcriptPrefix");
    const transcriptPrefix = typeof prefixRaw === "string" ? prefixRaw.trim() : "";

    const segmentTranscripts = form
      .getAll("segmentTranscript")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""));
    const segmentServerTranscripts = form
      .getAll("segmentServerTranscript")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""));

    const startedAt = Date.now();
    console.info("[quick-analysis/analyze] full mode started", {
      clips: blobs.length,
      browserSegments: segmentTranscripts.filter((t) => t.length > 0).length,
      prefetchedSegments: segmentServerTranscripts.filter((t) => t.length > 0).length,
    });
    try {
      const result = await runQuickAnalysisFull(
        blobs,
        transcriptPrefix,
        segmentTranscripts,
        segmentServerTranscripts,
      );
      console.info("[quick-analysis/analyze] full mode ok", {
        ms: Date.now() - startedAt,
        transcriptChars: result.transcript.length,
      });
      return NextResponse.json({
        scores: result.scores,
        transcript: result.transcript,
        coachSummary: {
          biggestIssue: result.coachSummary.biggestIssue,
          strength: result.coachSummary.strength,
          patterns: result.coachSummary.patterns,
          acousticPatterns: result.coachSummary.acousticPatterns,
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
    { error: "Invalid mode. Use transcript, deterministic, segment, or full." },
    { status: 400 },
  );
}
