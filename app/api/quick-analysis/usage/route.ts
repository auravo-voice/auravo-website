import { NextResponse } from "next/server";

import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { getQuickAnalysisUsageForUser } from "@/lib/billing/quick-analysis-entitlement";
import { getRazorpayKeyId } from "@/lib/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  const usage = await getQuickAnalysisUsageForUser(auth);
  let razorpayKeyId: string | null = null;
  try {
    razorpayKeyId = getRazorpayKeyId();
  } catch {
    razorpayKeyId = null;
  }

  return NextResponse.json({ usage, razorpayKeyId });
}
