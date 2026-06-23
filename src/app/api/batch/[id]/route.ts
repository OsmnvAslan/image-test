// GET /api/batch/[id] — JSON snapshot of a batch (PLAN.md §4.2).
// Poll fallback / debugging. 404 if the batch id is unknown.

import { NextResponse } from "next/server";
import { getBatch } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const batch = getBatch(params.id);
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  return NextResponse.json(batch);
}
