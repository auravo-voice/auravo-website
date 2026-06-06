import { NextResponse } from "next/server";

import { getQuickAnalysisUsage } from "@/db/queries/sqlite/quick-analysis-usage";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { getRazorpayKeyId } from "@/lib/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  const usage = await getQuickAnalysisUsage(auth);
  let razorpayKeyId: string | null = null;
  try {
    razorpayKeyId = getRazorpayKeyId();
  } catch {
    razorpayKeyId = null;
  }

  return NextResponse.json({ usage, razorpayKeyId });
}
