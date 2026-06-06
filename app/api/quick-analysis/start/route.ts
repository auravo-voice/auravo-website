import { NextResponse } from "next/server";

import { getQuickAnalysisUsage, recordQuickAnalysisRun } from "@/db/queries/sqlite/quick-analysis-usage";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import {
  assertCanStartQuickAnalysis,
  QuickAnalysisPaywallError,
} from "@/lib/billing/quick-analysis-entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reserve one daily assessment slot when the learner begins Quick Analysis. */
export async function POST() {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  try {
    await assertCanStartQuickAnalysis(auth);
    await recordQuickAnalysisRun(auth);
    const usage = await getQuickAnalysisUsage(auth);
    return NextResponse.json({ ok: true, usage });
  } catch (e) {
    if (e instanceof QuickAnalysisPaywallError) {
      return NextResponse.json(
        { error: e.message, code: e.code, usage: e.usage },
        { status: 402 },
      );
    }
    const msg = e instanceof Error ? e.message : "Could not start assessment.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
