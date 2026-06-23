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

// Short generic subject descriptor used when the product image can't be captioned
// AND the filename gives us nothing usable.
export const FALLBACK_PRODUCT_DESCRIPTION = "the product, centered hero shot";

// Derive a usable image SUBJECT from a product filename when vision is unavailable
// (e.g. quota exhausted). "sneaker.jpg" -> "sneaker, product shot". This keeps the
// GENERATED image about the right object instead of a generic blob — without it,
// every product gets the same generic prompt and Pollinations renders the same
// thing for all of them. Returns the generic fallback only when the name is noise.
export function subjectFromName(productName: string): string {
  const raw = (productName || "")
    .replace(/\.[a-z0-9]+$/i, "") // drop extension
    .replace(/[-_]+/g, " ")
    .replace(/\b(prod|product|img|image|photo|final|copy|untitled|download)\b/gi, " ")
    .replace(/\d+/g, " ") // drop bare numbers like "Product 2" / "IMG 4821"
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!raw) return FALLBACK_PRODUCT_DESCRIPTION;
  // Steer the text->image model toward a clearly recognizable, realistic object.
  // A terse "watch, product shot" tends to render as an abstract blob on free
  // models, so we name it as a real photographed product explicitly.
  return `a realistic ${raw}, the actual ${raw} product clearly visible, detailed professional product photograph`;
}

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
