import type { Metadata } from "next";
import SubmissionWriteup from "@/components/SubmissionWriteup";

export const metadata: Metadata = {
  title: "Batch Creative — Submission",
  description: "Batch product → styled social posts. Take-home submission.",
};

export default function SubmissionPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-14 animate-float-in">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Engineering Challenge · Take-home
        </p>
        <h1 className="text-4xl font-black tracking-tight">
          <span className="gradient-text">Batch Creative</span>
        </h1>
        <p className="mt-3 text-lg text-slate-400">
          Upload N product images + 1–2 reference images → N styled social posts,
          one per product, each rendering as it lands.
        </p>
      </header>

      <SubmissionWriteup />

      <footer className="mt-4 border-t border-white/10 pt-6 text-sm text-slate-500">
        Batch Creative — take-home submission.
      </footer>
    </main>
  );
}
