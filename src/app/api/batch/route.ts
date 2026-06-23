// POST /api/batch — create + start a batch (PLAN.md §4.2, §3).
//
// Parses multipart/form-data (products[], references[]), derives ONE shared
// style fingerprint from the reference(s), creates one job per product, then
// FIRES the fan-out work WITHOUT awaiting it so the POST returns immediately
// with { batchId, productCount }. The async work runs jobs through a
// concurrency pool; each job's failure is isolated (per-job try/catch) so a
// failing product never stops its siblings.

import { NextResponse } from "next/server";
import {
  buildStyleFingerprint,
  describeProduct,
  buildProductPrompt,
} from "@/lib/style";
import { generatePost } from "@/lib/generation";
import { createBatch, updateJob, completeBatch, newId } from "@/lib/store";
import { runPool, defaultConcurrency } from "@/lib/pool";
import type { ProductJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function toBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const products = form.getAll("products").filter((v): v is File => v instanceof File);
  const references = form.getAll("references").filter((v): v is File => v instanceof File);

  // ---- Validation (PLAN §4.2): >=1 product, 1..2 references ----
  if (products.length === 0) {
    return NextResponse.json(
      { error: "At least one product image is required" },
      { status: 400 },
    );
  }
  if (references.length === 0) {
    return NextResponse.json(
      { error: "At least one reference image is required" },
      { status: 400 },
    );
  }
  if (references.length > 2) {
    return NextResponse.json(
      { error: "At most two reference images are allowed" },
      { status: 400 },
    );
  }

  // Convert all files to Buffers up front. These Buffers are captured by the
  // fire-and-forget closure below and stay alive for the duration of the work.
  const refBuffers = await Promise.all(references.map(toBuffer));
  const productBuffers = await Promise.all(products.map(toBuffer));
  const productNames = products.map((f, i) => f.name || `Product ${i + 1}`);

  // ONE shared style fingerprint per batch (consistency axis).
  const fingerprint = await buildStyleFingerprint(refBuffers);

  // One job per product, all pending.
  const jobs: ProductJob[] = productBuffers.map((_buf, i) => ({
    id: newId(),
    productName: productNames[i],
    status: "pending",
    attempts: 0,
  }));

  const batch = createBatch(jobs, fingerprint);

  // ---- Fan-out (fire-and-forget): do NOT await, so POST returns immediately.
  // Each product runs through the pool; per-job try/catch isolates failures so
  // a failing job never stops its siblings. When all jobs are terminal we mark
  // the batch complete (emits the `done` event).
  const limit = defaultConcurrency();
  void runPool(productBuffers, limit, async (buf, i) => {
    const job = jobs[i];
    updateJob(batch.id, job.id, { status: "running" });
    try {
      const desc = await describeProduct(buf);
      const prompt = buildProductPrompt(fingerprint, desc);
      const result = await generatePost({
        productImage: buf,
        productName: productNames[i],
        stylePrompt: prompt,
      });
      updateJob(batch.id, job.id, {
        status: "done",
        imageDataUrl: result.imageDataUrl,
        provider: result.provider,
        attempts: result.attempts,
      });
    } catch (e) {
      // generatePost essentially never throws (mock is the last provider), but
      // be safe: isolate the failure to this one card.
      updateJob(batch.id, job.id, {
        status: "failed",
        error: String(e),
      });
    }
  })
    .catch(() => {
      // Pool-level safety net — individual jobs already handle their own errors.
    })
    .finally(() => {
      completeBatch(batch.id);
    });

  return NextResponse.json({
    batchId: batch.id,
    productCount: jobs.length,
  });
}
