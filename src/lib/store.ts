// In-memory batch store + per-batch event emitter (PLAN.md §6).
//
// A single `Map<batchId, Batch>` holds all batch state for the life of the
// process (lost on restart — documented scope cut). Each batch gets its own
// Node EventEmitter so SSE clients can subscribe to job/done events.
//
// Mutations go through updateJob/completeBatch, which both mutate the stored
// Batch AND emit a StreamEvent so subscribers see every state change.

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Batch, ProductJob, StreamEvent } from "@/lib/types";

const batches = new Map<string, Batch>();
const emitters = new Map<string, EventEmitter>();

function emitterFor(batchId: string): EventEmitter {
  let emitter = emitters.get(batchId);
  if (!emitter) {
    emitter = new EventEmitter();
    // Many SSE clients may subscribe to one batch; lift the default cap.
    emitter.setMaxListeners(0);
    emitters.set(batchId, emitter);
  }
  return emitter;
}

function emit(batchId: string, event: StreamEvent): void {
  emitterFor(batchId).emit("event", event);
}

/**
 * Create a batch from a list of jobs + the shared style fingerprint and store it.
 * Caller is responsible for kicking off the fan-out work.
 */
export function createBatch(
  jobs: ProductJob[],
  styleFingerprint: string,
): Batch {
  const batch: Batch = {
    id: randomUUID(),
    status: "running",
    styleFingerprint,
    jobs,
    createdAt: Date.now(),
  };
  batches.set(batch.id, batch);
  return batch;
}

export function getBatch(id: string): Batch | undefined {
  return batches.get(id);
}

/**
 * Mutate a single job in place, then emit a `{type:"job", job}` event so any
 * SSE subscriber forwards the new state. No-op if batch/job is unknown.
 */
export function updateJob(
  batchId: string,
  jobId: string,
  patch: Partial<ProductJob>,
): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  const job = batch.jobs.find((j) => j.id === jobId);
  if (!job) return;
  Object.assign(job, patch);
  emit(batchId, { type: "job", job });
}

/**
 * Mark the batch complete and emit a terminal `{type:"done", batchId}` event.
 */
export function completeBatch(batchId: string): void {
  const batch = batches.get(batchId);
  if (!batch) return;
  batch.status = "complete";
  emit(batchId, { type: "done", batchId });
}

/**
 * Subscribe to a batch's stream events. Returns an unsubscribe function.
 * Returns undefined if the batch id is unknown.
 */
export function subscribe(
  batchId: string,
  listener: (event: StreamEvent) => void,
): (() => void) | undefined {
  if (!batches.has(batchId)) return undefined;
  const emitter = emitterFor(batchId);
  emitter.on("event", listener);
  return () => {
    emitter.off("event", listener);
  };
}

// Helper id generator for jobs (createBatch uses randomUUID for batch ids;
// route uses this for job ids).
export function newId(): string {
  return randomUUID();
}
