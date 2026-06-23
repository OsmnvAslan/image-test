"use client";

import { useRef } from "react";

export interface SelectedFile {
  file: File;
  url: string; // object URL for preview
}

interface UploadAreaProps {
  products: SelectedFile[];
  references: SelectedFile[];
  onAddProducts: (files: File[]) => void;
  onAddReferences: (files: File[]) => void;
  onRemoveProduct: (index: number) => void;
  onRemoveReference: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  validationError: string | null;
}

function Thumb({
  item,
  onRemove,
}: {
  item: SelectedFile;
  onRemove: () => void;
}) {
  return (
    <div className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/5 transition hover:border-cyan-400/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.file.name}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.file.name}`}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs leading-none text-white backdrop-blur transition hover:bg-rose-500/90"
      >
        ×
      </button>
    </div>
  );
}

export default function UploadArea({
  products,
  references,
  onAddProducts,
  onAddReferences,
  onRemoveProduct,
  onRemoveReference,
  onSubmit,
  submitting,
  validationError,
}: UploadAreaProps) {
  const productInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    products.length >= 1 &&
    references.length >= 1 &&
    references.length <= 2 &&
    !submitting;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Products */}
        <div className="neon-border rounded-2xl glass p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className="text-cyan-400">◢</span> Product images
            </h2>
            <span className="font-mono text-xs text-cyan-300">
              {products.length} selected
            </span>
          </div>
          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onAddProducts(files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => productInputRef.current?.click()}
            className="group w-full rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-7 text-sm text-slate-400 transition hover:border-cyan-400/60 hover:bg-cyan-400/[0.06] hover:text-cyan-100"
          >
            <span className="block text-2xl opacity-60 transition group-hover:scale-110 group-hover:opacity-100">
              ⊕
            </span>
            <span className="mt-1 block">Add product images · ≥ 1, multiple</span>
          </button>
          {products.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {products.map((p, i) => (
                <Thumb key={i} item={p} onRemove={() => onRemoveProduct(i)} />
              ))}
            </div>
          )}
        </div>

        {/* References */}
        <div className="neon-border rounded-2xl glass p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className="text-fuchsia-400">◣</span> Reference style
              <span className="font-normal text-slate-500">(1–2)</span>
            </h2>
            <span className="font-mono text-xs text-fuchsia-300">
              {references.length} selected
            </span>
          </div>
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onAddReferences(files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => referenceInputRef.current?.click()}
            className="group w-full rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-7 text-sm text-slate-400 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-400/[0.06] hover:text-fuchsia-100"
          >
            <span className="block text-2xl opacity-60 transition group-hover:scale-110 group-hover:opacity-100">
              ⊕
            </span>
            <span className="mt-1 block">Add reference images · 1–2 style/mood</span>
          </button>
          {references.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {references.map((r, i) => (
                <Thumb key={i} item={r} onRemove={() => onRemoveReference(i)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {validationError && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          {validationError}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 px-7 py-3 text-sm font-bold text-white shadow-[0_0_30px_-8px_rgba(139,92,246,0.8)] transition hover:shadow-[0_0_40px_-4px_rgba(139,92,246,0.95)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Igniting batch…
          </>
        ) : (
          <>⚡ Generate posts</>
        )}
      </button>
    </div>
  );
}
