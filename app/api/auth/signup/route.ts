import { NextResponse } from "next/server";
import { createBrowserPocketBase } from "@/lib/pocketbase";
import { pocketBaseAuthErrorMessage } from "@/lib/pocketbase/errors";
import { isPocketBaseAuthEnabled } from "@/lib/storage/env";

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
  } catch (e) {
    return NextResponse.json({ error: pocketBaseAuthErrorMessage(e, "signup") }, { status: 400 });
  }

  try {
    await pb.collection("users").requestVerification(email);
  } catch (e) {
    console.error("[auth/signup] requestVerification failed:", e);
    return NextResponse.json(
      {
        error:
          "Your account was created, but we couldn't send a verification email. Try signing in or contact support.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ message: "Check your email to verify your account" }, { status: 200 });
}
