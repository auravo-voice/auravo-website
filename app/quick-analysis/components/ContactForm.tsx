"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SixDimensionScores } from "@/lib/assessment/heuristics";

type Props = {
  scores: SixDimensionScores;
  onSuccess: () => void;
};

export function ContactForm({ scores, onSuccess }: Props) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/quick-analysis/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone.trim() || undefined, scores }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-5 rounded-3xl border border-white/12 bg-white/5 p-7 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">Get your personalised plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your details and we&apos;ll follow up with a lesson plan tailored to your snapshot.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="qa-name">Name</Label>
        <Input
          id="qa-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Your name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="qa-email">Email</Label>
        <Input
          id="qa-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="qa-phone">Phone (optional)</Label>
        <Input
          id="qa-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+1 …"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="glow" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send my details"}
      </Button>
    </form>
  );
}
