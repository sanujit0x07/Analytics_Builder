import { NextResponse } from "next/server";
import { lookupJob } from "@/lib/jobs";
import { evaluateParameters } from "@/lib/evaluator";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = lookupJob(id);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!job.analysis) {
    return NextResponse.json({ values: [], reason: "no analysis yet" });
  }
  const selectedIds = new Set(
    job.selectedParamIds ?? job.analysis.parameters.map((p) => p.id)
  );
  const params_ = job.analysis.parameters.filter((p) => selectedIds.has(p.id));
  const contracts = job.contractAbis ?? [];

  const values = await evaluateParameters(params_, contracts);
  return NextResponse.json({ values });
}
