import { NextResponse } from "next/server";
import { setSelectedParams } from "@/lib/job-store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { paramIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.paramIds)) {
    return NextResponse.json(
      { error: "paramIds must be an array of strings" },
      { status: 400 }
    );
  }
  const ok = setSelectedParams(id, body.paramIds);
  if (!ok) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, count: body.paramIds.length });
}
