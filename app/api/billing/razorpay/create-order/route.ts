import { NextResponse } from "next/server";

import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { isQuickAnalysisPlanId } from "@/lib/billing/plans";
import { createQuickAnalysisOrder, getRazorpayKeyId } from "@/lib/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  let body: { planId?: string };
  try {
    body = (await req.json()) as { planId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!isQuickAnalysisPlanId(planId)) {
    return NextResponse.json({ error: "Invalid plan. Use monthly or yearly." }, { status: 400 });
  }

  try {
    const { order, plan } = await createQuickAnalysisOrder(auth, planId);
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      plan: {
        id: plan.id,
        label: plan.label,
        displayAmount: plan.displayAmount,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create payment order.";
    console.error("[billing/razorpay/create-order]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
