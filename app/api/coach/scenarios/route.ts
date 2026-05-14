import { NextResponse } from "next/server";
import { z } from "zod";
import { getScenariosLibraryServing } from "@/lib/coach/scenarios";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  q: z.string().optional(),
  customDescription: z.string().optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { q, customDescription } = parsed.data;
  const { data, warning } = await getScenariosLibraryServing({
    searchQuery: q,
    customDescription,
  });
  return NextResponse.json({ scenarios: data.scenarios, coachWarning: warning });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const { data, warning } = await getScenariosLibraryServing({ searchQuery: q ?? undefined });
  return NextResponse.json({ scenarios: data.scenarios, coachWarning: warning });
}
