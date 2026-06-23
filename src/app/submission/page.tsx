import type { Metadata } from "next";
import SubmissionWriteup from "@/components/SubmissionWriteup";

export const metadata: Metadata = {
  title: "Batch Creative — Submission",
  description: "Batch product → styled social posts. Take-home submission.",
};

export default function SubmissionPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-14">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-indigo-600">
          Engineering Challenge · Take-home
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
          Batch Creative
        </h1>
        <p className="mt-3 text-lg text-neutral-600">
          Upload N product images + 1–2 reference images → N styled social posts,
          one per product, each rendering as it lands.
        </p>
      </header>

      <SubmissionWriteup />

      <footer className="mt-4 border-t border-neutral-200 pt-6 text-sm text-neutral-400">
        Batch Creative — take-home submission.
      </footer>
    </main>
  );
}
