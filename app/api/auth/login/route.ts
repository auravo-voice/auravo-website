import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createBrowserPocketBase } from "@/lib/pocketbase";
import { pocketBaseAuthErrorMessage } from "@/lib/pocketbase/errors";
import { savePocketBaseAuthCookie } from "@/lib/pocketbase/server";
import { ensureUserProfile } from "@/db/queries/user";
import { repairUserDisplayNameIfNeeded } from "@/lib/auth/repair-user-display-name";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { isPocketBaseAuthEnabled, isSqliteStorage } from "@/lib/storage/env";
import { mapUserRecord } from "@/db/pocketbase-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = typeof obj.email === "string" ? obj.email.trim() : "";
  const password = typeof obj.password === "string" ? obj.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (!isPocketBaseAuthEnabled()) {
    const cookieStore = await cookies();
    let userId = cookieStore.get(AURAVO_USER_ID_COOKIE)?.value?.trim() ?? "";
    if (!userId) {
      return NextResponse.json(
        { error: "Set NEXT_PUBLIC_POCKETBASE_URL for email sign-in, or continue without signing in." },
        { status: 503 },
      );
    }
    const displayName = email.split("@")[0] || "Learner";
    await ensureUserProfile(userId, { displayName });
    const res = NextResponse.json({ ok: true, userId });
    res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
    return res;
  }

  const pb = createBrowserPocketBase();
  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch (e) {
    return NextResponse.json({ error: pocketBaseAuthErrorMessage(e, "login") }, { status: 401 });
  }

  let record = pb.authStore.record;
  if (record) {
    record = await repairUserDisplayNameIfNeeded(pb, record);
    pb.authStore.save(pb.authStore.token, record);
  }

  const userId = record?.id;
  if (userId && isSqliteStorage()) {
    const mapped = mapUserRecord(record!);
    await ensureUserProfile(userId, { displayName: mapped.displayName });
  }

  await savePocketBaseAuthCookie(pb);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: userId,
      email: pb.authStore.record?.email,
    },
  });
  if (userId && isSqliteStorage()) {
    res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  }
  return res;
}
