"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Batch, ProductJob, StreamEvent } from "@/lib/types";
import UploadArea, { type SelectedFile } from "@/components/UploadArea";
import ResultCard from "@/components/ResultCard";
import SubmissionWriteup from "@/components/SubmissionWriteup";

type Phase = "idle" | "submitting" | "streaming" | "complete";

export default function Page() {
  const [products, setProducts] = useState<SelectedFile[]>([]);
  const [references, setReferences] = useState<SelectedFile[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [jobs, setJobs] = useState<ProductJob[]>([]);
  const [styleFingerprint, setStyleFingerprint] = useState<string>("");
  const [fingerprintOpen, setFingerprintOpen] = useState(false);
  const [connectionNote, setConnectionNote] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const reconnectedRef = useRef(false);
  const batchIdRef = useRef<string | null>(null);

  // ---- cleanup of object URLs + EventSource on unmount ----
  useEffect(() => {
    return () => {
      esRef.current?.close();
      products.forEach((p) => URL.revokeObjectURL(p.url));
      references.forEach((r) => URL.revokeObjectURL(r.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- file selection helpers ----
  const addProducts = (files: File[]) => {
    setValidationError(null);
    setProducts((prev) => [
      ...prev,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  };

  const addReferences = (files: File[]) => {
    setReferences((prev) => {
      const next = [
        ...prev,
        ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ];
      if (next.length > 2) {
        setValidationError("At most 2 reference images are allowed.");
      } else {
        setValidationError(null);
      }
      return next;
    });
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeReference = (index: number) => {
    setReferences((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.url);
      const next = prev.filter((_, i) => i !== index);
      if (next.length <= 2) setValidationError(null);
      return next;
    });
  };

  // ---- SSE handling: seed grid from init, update card by job.id ----
  const openStream = useCallback((batchId: string) => {
    const es = new EventSource(`/api/batch/${batchId}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      let evt: StreamEvent;
      try {
        evt = JSON.parse(e.data) as StreamEvent;
      } catch {
        return;
      }

      if (evt.type === "init") {
        // Seed the grid from the full batch state.
        setStyleFingerprint(evt.batch.styleFingerprint);
        setJobs(evt.batch.jobs);
        setPhase(evt.batch.status === "complete" ? "complete" : "streaming");
        setConnectionNote(null);
      } else if (evt.type === "job") {
        // Update THAT card in place, matched by job.id.
        setJobs((prev) =>
          prev.map((j) => (j.id === evt.job.id ? evt.job : j))
        );
      } else if (evt.type === "done") {
        setPhase("complete");
        es.close();
        if (esRef.current === es) esRef.current = null;
      }
    };

    es.onerror = () => {
      // A normal close after "done" also surfaces here; ignore if complete.
      if (es.readyState === EventSource.CLOSED && !reconnectedRef.current) {
        // attempt exactly one reconnect
        reconnectedRef.current = true;
        setConnectionNote("Connection lost — reconnecting…");
        es.close();
        if (esRef.current === es) esRef.current = null;
        setTimeout(() => {
          if (batchIdRef.current === batchId) openStream(batchId);
        }, 1000);
      } else {
        setConnectionNote(
          "Connection lost. The batch may still be running on the server."
        );
      }
    };
  }, []);

  // ---- submit ----
  const handleSubmit = async () => {
    if (products.length < 1) {
      setValidationError("Add at least one product image.");
      return;
    }
    if (references.length < 1 || references.length > 2) {
      setValidationError("Add 1 or 2 reference images.");
      return;
    }

    setValidationError(null);
    setPhase("submitting");
    setConnectionNote(null);
    reconnectedRef.current = false;

    const fd = new FormData();
    products.forEach((p) => fd.append("products", p.file));
    references.forEach((r) => fd.append("references", r.file));

    try {
      const res = await fetch("/api/batch", { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          /* ignore */
        }
        setValidationError(msg);
        setPhase("idle");
        return;
      }

      const data = (await res.json()) as {
        batchId: string;
        productCount: number;
      };

      // Optimistic seed so cards appear before the init event arrives.
      setJobs(
        products.map((p, i) => ({
          id: String(i),
          productName: p.file.name || `Product ${i + 1}`,
          status: "pending",
          attempts: 0,
        }))
      );
      setPhase("streaming");
      batchIdRef.current = data.batchId;
      openStream(data.batchId);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Network error submitting batch."
      );
      setPhase("idle");
    }
  };

  // ---- reset for a new batch ----
  const handleReset = () => {
    esRef.current?.close();
    esRef.current = null;
    batchIdRef.current = null;
    reconnectedRef.current = false;
    products.forEach((p) => URL.revokeObjectURL(p.url));
    references.forEach((r) => URL.revokeObjectURL(r.url));
    setProducts([]);
    setReferences([]);
    setJobs([]);
    setStyleFingerprint("");
    setFingerprintOpen(false);
    setConnectionNote(null);
    setValidationError(null);
    setPhase("idle");
  };

  // ---- batch-level counts ----
  const total = jobs.length;
  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const terminal = done + failed;
  const showResults = phase === "streaming" || phase === "complete";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Batch Creative</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload products + reference style → one styled social post per product,
          rendered as each finishes.
        </p>
      </header>

      {!showResults ? (
        <UploadArea
          products={products}
          references={references}
          onAddProducts={addProducts}
          onAddReferences={addReferences}
          onRemoveProduct={removeProduct}
          onRemoveReference={removeReference}
          onSubmit={handleSubmit}
          submitting={phase === "submitting"}
          validationError={validationError}
        />
      ) : (
        <section className="space-y-5">
          {/* Batch status line */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  phase === "complete" ? "text-green-700" : "text-indigo-700"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    phase === "complete"
                      ? "bg-green-500"
                      : "animate-pulse bg-indigo-500"
                  }`}
                />
                {phase === "complete" ? "Batch complete" : "Running"}
              </span>
              <span className="text-gray-600">
                {terminal}/{total} done
                {failed > 0 && (
                  <span className="text-red-600"> · {failed} failed</span>
                )}
              </span>
            </div>

            {phase === "complete" && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Start new batch
              </button>
            )}
          </div>

          {connectionNote && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {connectionNote}
            </p>
          )}

          {/* Shared style fingerprint (consistency, collapsible) */}
          {styleFingerprint && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setFingerprintOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-gray-700"
              >
                <span>Shared style fingerprint</span>
                <span className="text-gray-400">
                  {fingerprintOpen ? "▲" : "▼"}
                </span>
              </button>
              {fingerprintOpen && (
                <p className="border-t border-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600">
                  {styleFingerprint}
                </p>
              )}
            </div>
          )}

          {/* Result grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <ResultCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* ───── Submission write-up (below the working app) ───── */}
      <section className="mt-16 border-t border-neutral-200 pt-12">
        <p className="mb-8 text-sm font-medium uppercase tracking-widest text-indigo-600">
          About this submission
        </p>
        <SubmissionWriteup />
      </section>
    </main>
  );
}
