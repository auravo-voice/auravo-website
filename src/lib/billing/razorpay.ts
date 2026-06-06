import "server-only";

import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { QuickAnalysisPlanId } from "@/lib/billing/plans";
import { QUICK_ANALYSIS_PLANS } from "@/lib/billing/plans";

function requireRazorpayKeys(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return { keyId, keySecret };
}

export function getRazorpayKeyId(): string {
  return requireRazorpayKeys().keyId;
}

export function getRazorpayClient(): Razorpay {
  const { keyId, keySecret } = requireRazorpayKeys();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createQuickAnalysisOrder(userId: string, planId: QuickAnalysisPlanId) {
  const plan = QUICK_ANALYSIS_PLANS[planId];
  const client = getRazorpayClient();
  const receipt = `qa_${userId.slice(0, 8)}_${Date.now()}`;
  const order = await client.orders.create({
    amount: plan.amountPaise,
    currency: "INR",
    receipt,
    notes: {
      userId,
      planId,
      product: "quick_analysis",
    },
  });
  return { order, plan };
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const { keySecret } = requireRazorpayKeys();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
