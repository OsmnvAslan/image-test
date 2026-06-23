// GET /api/batch/[id]/stream — Server-Sent Events stream of job updates
// (PLAN.md §4.2). Pushes one event per job state change + a terminal `done`.
//
// Event ordering (mandated by lead — BUILD-TIME CHECK #3):
//   subscribe -> init -> job* -> done -> close
// We subscribe to the batch emitter FIRST, THEN enqueue the `init` payload.
// Subscribing before init closes the race where a job event could fire in the
// gap between reading the snapshot and attaching the listener and be lost. Any
// event emitted during that window is now buffered by the listener and flushed
// right after init.

import { getBatch, subscribe } from "@/lib/store";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const batchId = params.id;
  const batch = getBatch(batchId);
  if (!batch) {
    return new Response(JSON.stringify({ error: "Batch not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | undefined;

      const send = (event: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (unsubscribe) unsubscribe();
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const onAbort = () => close();

      // ---- BUILD-TIME CHECK #3: subscribe BEFORE init ----
      // Attach the listener first so no job/done event emitted between the
      // snapshot read and listener attach is lost. Events that arrive before
      // we finish sending init are buffered and forwarded immediately after.
      const buffered: StreamEvent[] = [];
      let initSent = false;

      const onEvent = (event: StreamEvent) => {
        if (!initSent) {
          buffered.push(event);
          return;
        }
        send(event);
        if (event.type === "done") close();
      };

      unsubscribe = subscribe(batchId, onEvent);

      // Client disconnect → unsubscribe + close.
      if (req.signal.aborted) {
        close();
        return;
      }
      req.signal.addEventListener("abort", onAbort);

      // Now send the full current state as `init`.
      const current = getBatch(batchId);
      if (!current) {
        close();
        return;
      }
      send({ type: "init", batch: current });
      initSent = true;

      // Flush anything that arrived during subscribe→init.
      for (const event of buffered) {
        send(event);
        if (event.type === "done") {
          close();
          return;
        }
      }
      buffered.length = 0;

      // If the batch is ALREADY complete when this client connects (and we
      // didn't already see a buffered done), emit a done and close so late
      // subscribers terminate cleanly.
      if (current.status === "complete") {
        send({ type: "done", batchId });
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
