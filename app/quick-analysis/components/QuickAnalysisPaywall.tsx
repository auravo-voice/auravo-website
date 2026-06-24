"use client";

import * as React from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QUICK_ANALYSIS_PLANS, type QuickAnalysisPlanId } from "@/lib/billing/plans";
import type { QuickAnalysisUsageSnapshot } from "@/lib/billing/quick-analysis-usage-types";
import { readJsonResponse } from "@/lib/api/read-json-response";

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayHandlerResponse) => void;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function QuickAnalysisPaywall({
  razorpayKeyId,
  usage,
  onSubscribed,
}: {
  razorpayKeyId: string | null;
  usage?: QuickAnalysisUsageSnapshot | null;
  onSubscribed: () => void;
}) {
  const [loadingPlan, setLoadingPlan] = React.useState<QuickAnalysisPlanId | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const sessionExhausted = usage?.subscribed && (usage.remainingSessions ?? 0) <= 0;

  const openCheckout = React.useCallback(
    async (planId: QuickAnalysisPlanId) => {
      if (!razorpayKeyId || !window.Razorpay) {
        setError("Payments are not configured yet. Please try again later.");
        return;
      }
      setError(null);
      setLoadingPlan(planId);
      try {
        const orderRes = await fetch("/api/billing/razorpay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        });
        const orderData = await readJsonResponse(orderRes);
        if (!orderRes.ok) {
          throw new Error(typeof orderData.error === "string" ? orderData.error : "Could not start checkout.");
        }

        const plan = QUICK_ANALYSIS_PLANS[planId];
        const checkout = new window.Razorpay({
          key: razorpayKeyId,
          amount: orderData.amount as number,
          currency: (orderData.currency as string) ?? "INR",
          name: "Auravo",
          description: `Voca coach — ${plan.label}`,
          order_id: orderData.orderId as string,
          theme: { color: "#ff6600" },
          handler: async (response) => {
            try {
              const verifyRes = await fetch("/api/billing/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  planId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyData = await readJsonResponse(verifyRes);
              if (!verifyRes.ok) {
                throw new Error(
                  typeof verifyData.error === "string" ? verifyData.error : "Payment verification failed.",
                );
              }
              onSubscribed();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Payment verification failed.");
            } finally {
              setLoadingPlan(null);
            }
          },
        });
        checkout.open();
        setLoadingPlan(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed.");
        setLoadingPlan(null);
      }
    },
    [onSubscribed, razorpayKeyId],
  );

  return (
    <Card className="w-full max-w-lg border-primary/20 bg-card/80">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Keep practicing with Voca</CardTitle>
        <CardDescription>
          {sessionExhausted
            ? "You've used all coach sessions in your plan. Renew to keep practicing with Quick Analysis and Voca."
            : "You've used your 3 free assessments for today. Subscribe for more Quick Analysis and Voca coach sessions."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(["monthly", "yearly"] as const).map((planId) => {
          const plan = QUICK_ANALYSIS_PLANS[planId];
          return (
            <Button
              key={planId}
              variant={planId === "yearly" ? "glow" : "outline"}
              size="lg"
              className="h-auto flex-col items-start gap-1 py-4"
              disabled={loadingPlan != null}
              onClick={() => void openCheckout(planId)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-semibold">{plan.label}</span>
                <span className="font-display text-lg">{plan.displayAmount}</span>
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {plan.sessionLimit} coach sessions (Quick Analysis + Voca)
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {planId === "yearly" ? "Best value — save ₹1,400 vs monthly" : "Billed every month"}
              </span>
              {loadingPlan === planId ? (
                <span className="flex items-center gap-2 text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  Opening checkout…
                </span>
              ) : null}
            </Button>
          );
        })}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
