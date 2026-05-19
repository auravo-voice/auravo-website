import { NextResponse } from "next/server";
import { createBrowserPocketBase } from "@/lib/pocketbase";
import { savePocketBaseAuthCookie } from "@/lib/pocketbase/server";

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
  const passwordConfirm =
    typeof obj.passwordConfirm === "string" ? obj.passwordConfirm : password;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const pb = createBrowserPocketBase();
  try {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm,
      name: name || "Learner",
      display_name: name || "Learner",
    });
    await pb.collection("users").authWithPassword(email, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create account.";
    return NextResponse.json({ error: msg }, { status: 400 });
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
