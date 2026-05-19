import { NextResponse } from "next/server";
import { clearPocketBaseAuthCookie } from "@/lib/pocketbase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearPocketBaseAuthCookie();
  return NextResponse.json({ ok: true });
}
