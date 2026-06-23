// Style agent — keyless / failure fallbacks (PLAN.md §7, §8).
//
// SCOPE CUT (documented): when OPENROUTER_API_KEY is absent, or the vision call
// errors / times out, we degrade to these deterministic values instead of throwing.
// The fingerprint is a FIXED string, so every product in a batch — and every batch —
// shares the exact same style spine. That is what keeps outputs uniform on the
// keyless path: consistency by construction, not by luck. Per-product variation is
// reduced (all products get the same generic descriptor) but the pipeline still runs.

// Fixed deterministic style spine. Reused verbatim for all N products on the keyless
// path → guaranteed uniform style across the whole batch.
export const FALLBACK_FINGERPRINT =
  "Soft natural daylight with gentle directional shadows, warm neutral palette, " +
  "calm minimalist mood, clean editorial composition with generous negative space, " +
  "smooth matte studio surface, shallow depth of field shot on a 50mm lens.";

// Short generic subject descriptor used when the product image can't be captioned.
export const FALLBACK_PRODUCT_DESCRIPTION = "the product, centered hero shot";

// Deterministic social copy when the model can't write a caption. Derives a tidy
// title from the product name (preferred) or description so the post still reads
// as a real post. Never returns a bare number or empty string.
export function fallbackCopy(
  productName: string,
  productDescription: string
): { headline: string; caption: string } {
  const base = cleanName(productName) || titleCase(productDescription) || "New Arrival";
  // Only prefix "the" when the base doesn't already read like a phrase starting
  // with an article, so we never get "Meet the the product...".
  const subject = base.toLowerCase();
  const caption = /^(the|a|an|our)\b/.test(subject)
    ? `Meet ${subject} — now in our latest collection.`
    : `Meet the ${subject} — now in our latest collection.`;
  return { headline: base, caption };
}

// Turn a filename/label into a readable title WITHOUT dropping meaningful tokens.
// We strip the extension and separators, drop only pure-noise tokens, and — crucially
// — keep the original if stripping would leave nothing (so "Product 2" stays "Product
// 2", not "2", and "image.png" stays "Image", not "").
function cleanName(name: string): string {
  const raw = (name || "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  if (!raw) return "";
  const noiseOnly = /^(prod|product|img|image|final|copy|untitled|download|\d+)(\s+(prod|product|img|image|final|copy|\d+))*$/i;
  // If the name is nothing but noise words / numbers, keep it as-is (better a real
  // label than an empty or number-only headline); otherwise drop trailing noise tokens.
  const cleaned = noiseOnly.test(raw)
    ? raw
    : raw.replace(/\b(prod|product|img|image|final|copy)\b/gi, " ").replace(/\s+/g, " ").trim();
  return titleCase(cleaned || raw);
}

function titleCase(s: string): string {
  return (s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
