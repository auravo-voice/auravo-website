import { NextResponse } from "next/server";
import { clearPocketBaseAuthCookie } from "@/lib/pocketbase/server";
import { AURAVO_USER_ID_COOKIE } from "@/lib/auth/auravo-user-cookie-constants";
import { isPocketBaseAuthEnabled } from "@/lib/storage/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (isPocketBaseAuthEnabled()) {
    await clearPocketBaseAuthCookie();
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AURAVO_USER_ID_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
