"use client";

import { useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function OAuthButtons() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const error = searchParams.get("error");

  function googleHref() {
    const q = new URLSearchParams({ provider: "google" });
    if (redirect) q.set("redirect", redirect);
    return `/api/auth/oauth2/start?${q.toString()}`;
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button variant="outline" className="w-full gap-2" asChild>
        <a href={googleHref()}>
          <Globe className="size-4" />
          Continue with Google
        </a>
      </Button>
      <OAuthEmailDivider />
    </div>
  );
}

function OAuthEmailDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <Separator className="flex-1" />
      or email
      <Separator className="flex-1" />
    </div>
  );
}
