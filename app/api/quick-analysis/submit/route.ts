import { NextResponse } from "next/server";
import { z } from "zod";

import { insertQuickAnalysisLead } from "@/db/queries/sqlite/quick-analysis-leads";
import { isSqliteStorage } from "@/lib/storage/env";

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
  phone: z
    .string()
    .max(40)
    .optional()
    .transform((v) => (v ?? "").trim()),
  scores: scoresSchema,
});

export async function POST(req: Request) {
  if (!isSqliteStorage()) {
    return NextResponse.json(
      {
        error:
          "Lead capture requires SQLite storage (AURAVO_STORAGE=sqlite). Set AURAVO_DB_DIR to a writable path.",
      },
      { status: 503 },
    );
  }

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

  try {
    const id = await insertQuickAnalysisLead({ name, email, phone, scores });
    console.info("[quick-analysis/lead] saved", { id, email, phoneLength: phone.length });

    const webhook = process.env.QUICK_ANALYSIS_LEAD_WEBHOOK_URL?.trim();
    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "quick-analysis",
            id,
            at: new Date().toISOString(),
            name,
            email,
            phone,
            scores,
          }),
          signal: AbortSignal.timeout(8_000),
        });
      } catch (e) {
        console.error("[quick-analysis/submit] webhook failed:", e);
      }
    }

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[quick-analysis/submit] sqlite save failed:", e);
    return NextResponse.json(
      { error: "We could not save your details. Please try again in a moment." },
      { status: 500 },
    );
  }
}
