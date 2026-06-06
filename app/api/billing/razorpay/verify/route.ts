import { NextResponse } from "next/server";

import { upsertUserSubscription } from "@/db/queries/sqlite/quick-analysis-usage";
import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { isQuickAnalysisPlanId, QUICK_ANALYSIS_PLANS } from "@/lib/billing/plans";
import { verifyRazorpayPaymentSignature } from "@/lib/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  let body: {
    planId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

  if (!isQuickAnalysisPlanId(planId) || !orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  const plan = QUICK_ANALYSIS_PLANS[planId];
  const now = Date.now();
  const expiresAt = now + plan.durationDays * 24 * 60 * 60 * 1000;

  await upsertUserSubscription({
    userId: auth,
    planId,
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    expiresAt,
    now,
  });

  return NextResponse.json({
    ok: true,
    planId,
    expiresAt,
  });
}
