import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quick Analysis lead form — temporarily disabled. */
export async function POST() {
  return NextResponse.json({ error: "Quick Analysis is temporarily disabled." }, { status: 503 });
}

/*
import nodemailer from "nodemailer";
import { z } from "zod";
...
*/
