import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quick Analysis API — temporarily disabled. */
export async function POST() {
  return NextResponse.json({ error: "Quick Analysis is temporarily disabled." }, { status: 503 });
}

/*
import { rm } from "node:fs/promises";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { runDeterministicQuickAnalysis } from "@/lib/quick-analysis/deterministic-analysis";
import { scoreQuickAnalysisFromTranscript } from "@/lib/quick-analysis/score-from-transcript";
import { writeTempAudioFile } from "@/lib/storage/temp-audio";
import { TranscriptionUnavailableError } from "@/lib/transcription";

const QUICK_ANALYSIS_USER_ID = "00000000-0000-0000-0000-000000000099";

export async function POST(req: Request) {
  ...
}
*/
