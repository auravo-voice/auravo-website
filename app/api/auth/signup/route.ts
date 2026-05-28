import { NextResponse } from "next/server";
import { createBrowserPocketBase } from "@/lib/pocketbase";
import { savePocketBaseAuthCookie } from "@/lib/pocketbase/server";
import { ensureUserProfile } from "@/db/queries/user";
import {
  AURAVO_USER_ID_COOKIE,
  auravoUserIdCookieOptions,
} from "@/lib/auth/auravo-user-cookie";
import { isPocketBaseAuthEnabled, isSqliteStorage } from "@/lib/storage/env";
import { mapUserRecord } from "@/db/pocketbase-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isPocketBaseAuthEnabled()) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_POCKETBASE_URL to create an account with email." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = typeof obj.email === "string" ? obj.email.trim() : "";
  const password = typeof obj.password === "string" ? obj.password : "";
  const passwordConfirm = typeof obj.passwordConfirm === "string" ? obj.passwordConfirm : password;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const pb = createBrowserPocketBase();
  try {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm,
      name: name || email.split("@")[0],
      display_name: name || email.split("@")[0],
    });
    await pb.collection("users").authWithPassword(email, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create account.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = pb.authStore.record?.id;
  if (userId && isSqliteStorage()) {
    const mapped = mapUserRecord(pb.authStore.record!);
    await ensureUserProfile(userId, { displayName: mapped.displayName });
  }

  await savePocketBaseAuthCookie(pb);
  const res = NextResponse.json({
    ok: true,
    user: { id: userId, email: pb.authStore.record?.email },
  });
  if (userId && isSqliteStorage()) {
    res.cookies.set(AURAVO_USER_ID_COOKIE, userId, auravoUserIdCookieOptions());
  }
  return res;
}
