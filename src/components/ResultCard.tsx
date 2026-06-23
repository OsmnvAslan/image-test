"use client";

import type { ProductJob } from "@/lib/types";

export default function ResultCard({ job }: { job: ProductJob }) {
  const base =
    "flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm";

  if (job.status === "failed") {
    return (
      <div className={`${base} border-red-300 bg-red-50`}>
        <div className="flex aspect-square items-center justify-center bg-red-100/60 p-4 text-center">
          <span className="text-3xl text-red-400">⚠</span>
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate text-sm font-medium text-gray-900" title={job.productName}>
            {job.productName}
          </p>
          <p className="text-xs text-red-700">
            {job.error ?? "Generation failed"}
          </p>
          <p className="text-[11px] text-red-500">attempts: {job.attempts}</p>
        </div>
      </div>
    );
  }

  if (job.status === "done" && job.imageDataUrl) {
    return (
      <div className={`${base} border-gray-200`}>
        <div className="relative aspect-square bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={job.imageDataUrl}
            alt={job.productName}
            className="h-full w-full object-cover"
          />
          {/* Headline overlaid on the image — real HTML text, crisp at any size. */}
          {job.headline && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8">
              <p className="text-lg font-bold leading-tight text-white drop-shadow">
                {job.headline}
              </p>
            </div>
          )}
          <div className="absolute right-1 top-1 flex gap-1">
            {job.provider && (
              <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {job.provider}
              </span>
            )}
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {job.attempts} {job.attempts === 1 ? "try" : "tries"}
            </span>
          </div>
        </div>
        <div className="space-y-1 p-3">
          {job.caption && (
            <p className="text-sm text-gray-800">{job.caption}</p>
          )}
          <p className="truncate text-xs text-gray-400" title={job.productName}>
            {job.productName}
          </p>
        </div>
      </div>
    );
  }

  // pending / running
  const label = job.status === "running" ? "generating…" : "queued";
  return (
    <div className={`${base} border-gray-200`}>
      <div className="flex aspect-square animate-pulse items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-2">
          {job.status === "running" && (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
          )}
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-700" title={job.productName}>
          {job.productName}
        </p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}
