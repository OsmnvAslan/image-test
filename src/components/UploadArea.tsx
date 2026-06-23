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
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-gray-300 bg-gray-50">
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
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80"
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Products */}
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Product images
            </h2>
            <span className="text-xs text-gray-500">{products.length} selected</span>
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
            className="w-full rounded-md border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            Click to add product images (≥ 1, multiple allowed)
          </button>
          {products.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {products.map((p, i) => (
                <Thumb key={i} item={p} onRemove={() => onRemoveProduct(i)} />
              ))}
            </div>
          )}
        </div>

        {/* References */}
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Reference images <span className="font-normal text-gray-500">(1–2)</span>
            </h2>
            <span className="text-xs text-gray-500">{references.length} selected</span>
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
            className="w-full rounded-md border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            Click to add reference images (1–2 style/mood)
          </button>
          {references.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {references.map((r, i) => (
                <Thumb key={i} item={r} onRemove={() => onRemoveReference(i)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {validationError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {validationError}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {submitting ? "Starting batch…" : "Generate posts"}
      </button>
    </div>
  );
}
