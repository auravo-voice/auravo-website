"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyAuthSessionChanged } from "@/components/auth/auth-provider";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { email, password, passwordConfirm: password, name }
            : { email, password },
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        return;
      }
      if (mode === "signup") {
        setNotice("We've sent a verification email to your inbox. Please verify before logging in.");
        return;
      }
      notifyAuthSessionChanged();
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.replace(redirect);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <OAuthButtons />
      <form className="space-y-5" onSubmit={onSubmit}>
      {mode === "signup" ? (
        <AuthField id="name" label="Name" value={name} onChange={setName} type="text" placeholder="Your name" />
      ) : null}
      <AuthField
        id="email"
        label="Email"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="you@company.com"
      />
      <AuthField
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
        type="password"
        placeholder="••••••••"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950">
          {notice}
        </p>
      ) : null}
      <Button className="w-full gap-2" type="submit" disabled={pending}>
        <Mail className="size-4" />
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            New to Talking Labs?{" "}
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
      </form>
    </>
  );
}

function AuthField({
  id,
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder: string;
}) {
  return (
    <AuthFieldBlock id={id} label={label}>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
    </AuthFieldBlock>
  );
}

function AuthFieldBlock({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
