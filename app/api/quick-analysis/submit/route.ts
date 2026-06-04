import { NextResponse } from "next/server";
import { z } from "zod";

import type { SixDimensionScores } from "@/lib/assessment/heuristics";
import { sendQuickAnalysisLeadEmail } from "@/lib/quick-analysis/send-lead-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scoresSchema = z.object({
  pronunciation: z.number(),
  grammar: z.number(),
  fluency: z.number(),
  vocabulary: z.number(),
  filler_words: z.number(),
  pacing: z.number(),
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  scores: scoresSchema,
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid contact details." }, { status: 400 });
  }

  const { name, email, phone, scores } = parsed.data;
  const lead = {
    source: "quick-analysis" as const,
    at: new Date().toISOString(),
    name,
    email,
    phone: phone ?? null,
    scores: scores satisfies SixDimensionScores,
  };

  console.info("[quick-analysis/lead]", JSON.stringify(lead));

  try {
    await sendQuickAnalysisLeadEmail(lead);
  } catch (e) {
    console.error("[quick-analysis/submit] email failed:", e);
    return NextResponse.json(
      {
        error:
          "We could not send your details by email. Please try again in a moment or contact support@auravo.ai directly.",
      },
      { status: 503 },
    );
  }

  const webhook = process.env.QUICK_ANALYSIS_LEAD_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(8_000),
      });
    } catch (e) {
      console.error("[quick-analysis/submit] webhook failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
