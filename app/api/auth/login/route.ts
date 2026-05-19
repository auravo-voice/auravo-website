import { NextResponse } from "next/server";
import { createBrowserPocketBase } from "@/lib/pocketbase";
import { clearPocketBaseAuthCookie, savePocketBaseAuthCookie } from "@/lib/pocketbase/server";

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

  const pb = createBrowserPocketBase();
  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid email or password.";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  await savePocketBaseAuthCookie(pb);
  return NextResponse.json({
    ok: true,
    user: {
      id: pb.authStore.record?.id,
      email: pb.authStore.record?.email,
    },
  });
}
