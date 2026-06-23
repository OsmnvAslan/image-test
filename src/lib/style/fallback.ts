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
