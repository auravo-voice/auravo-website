import { NextResponse } from "next/server";

import { isAuthError, requireApiUserId } from "@/lib/auth/require-auth";
import { readStaticQuickAnalysisTts } from "@/lib/quick-analysis/static-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATIC_CACHE = "public, max-age=31536000, immutable";

export async function POST(req: Request) {
  const auth = await requireApiUserId();
  if (isAuthError(auth)) return auth;

  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const staticAudio = readStaticQuickAnalysisTts(text);
  if (staticAudio) {
    return new Response(staticAudio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": STATIC_CACHE,
      },
    });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[quick-analysis/tts] Deepgram error:", err);
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }

  const audioBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("Content-Type")?.split(";")[0]?.trim() || "audio/mpeg";
  return new Response(audioBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
