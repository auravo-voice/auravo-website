import { NextResponse } from "next/server";
import { rm } from "node:fs/promises";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { runDeterministicQuickAnalysis } from "@/lib/quick-analysis/deterministic-analysis";
import { scoreQuickAnalysisFromTranscript } from "@/lib/quick-analysis/score-from-transcript";
import { withQuickAnalysisWhisperModel } from "@/lib/quick-analysis/whisper-model";
import { concatAudioToWav } from "@/lib/audio/concat";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { TranscriptionUnavailableError } from "@/lib/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUICK_ANALYSIS_USER_ID = "00000000-0000-0000-0000-000000000099";

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

  if (mode === "full") {
    const blobs = form
      .getAll("audio")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (blobs.length < 1) {
      return NextResponse.json({ error: "At least one audio clip is required." }, { status: 400 });
    }

    const prefixRaw = form.get("transcriptPrefix");
    const transcriptPrefix = typeof prefixRaw === "string" ? prefixRaw.trim() : "";

    const tempPaths: string[] = [];
    let workDir: string | null = null;
    try {
      for (let i = 0; i < blobs.length; i++) {
        const { absolutePath } = await writeTempAudioFile(`qa-full-${Date.now()}-${i}`, blobs[i]!);
        tempPaths.push(absolutePath);
      }
      const { wavPath, workDir: dir } = await concatAudioToWav(tempPaths);
      workDir = dir;

      const analysis = await withQuickAnalysisWhisperModel(() =>
        runAnalysis({
          audio: { mode: "single", absolutePath: wavPath },
          context: {
            userId: QUICK_ANALYSIS_USER_ID,
            runCoachSummary: true,
            learnerContextHint: { displayName: "Guest" },
          },
        }),
      );

      const transcript = transcriptPrefix
        ? `${transcriptPrefix}\n\n${analysis.transcript}`.trim()
        : analysis.transcript;

      return NextResponse.json({
        scores: analysis.scores,
        transcript,
        coachSummary: {
          biggestIssue: analysis.coachSummary.biggestIssue,
          strength: analysis.coachSummary.strength,
          patterns: analysis.coachSummary.patterns,
          acousticPatterns: analysis.coachSummary.acousticPatterns,
          summary: analysis.coachSummary.summary,
          strengths: analysis.coachSummary.strengths,
          improvementAreas: analysis.coachSummary.improvementAreas,
        },
      });
    } catch (e) {
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
    } finally {
      await Promise.all(tempPaths.map((p) => rm(p, { force: true }).catch(() => {})));
      if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return NextResponse.json({ error: "Invalid mode. Use transcript, deterministic, or full." }, { status: 400 });
}
