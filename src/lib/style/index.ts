// Style agent — public module (PLAN.md §4.4, §7).
//
// Two decoupled axes, combined per job:
//   1. buildStyleFingerprint(references) — the SHARED style spine (consistency axis).
//      Computed ONCE per batch, reused VERBATIM for all N products.
//   2. describeProduct(productImage)     — what THIS product is (per-product axis).
//      Computed once per product, so each card is about its own subject.
// buildProductPrompt glues them: fingerprint stays verbatim, product description is
// the only variable slot.
//
// Both vision calls use the SAME OpenRouter model behind one OPENROUTER_API_KEY.
// On ANY failure (no key / HTTP error / timeout / empty) these functions NEVER throw
// — they degrade to the deterministic fallbacks in ./fallback so the pipeline always
// runs. See PLAN.md §7/§8 (documented scope cut).

import { visionCaption, textCompletion } from "./openrouter";
import {
  FALLBACK_FINGERPRINT,
  FALLBACK_PRODUCT_DESCRIPTION,
  fallbackCopy,
} from "./fallback";

// Instruction sent for the shared style spine. We explicitly ask for ONLY
// transferable style attributes and to exclude the specific objects, so the
// fingerprint can be reused across different products.
const FINGERPRINT_INSTRUCTION =
  "You are a visual style analyst. Look at the reference image(s) and synthesize ONE " +
  "shared visual style as a single compact paragraph (about 40 words). Describe ONLY " +
  "transferable style: color palette, lighting, mood, composition, surface/texture, " +
  "and lens/depth of field. Do NOT name or describe any specific objects, products, " +
  "or subjects. Output the paragraph only, no preamble.";

// Instruction sent per product. We want only the subject identity, no style/background.
const PRODUCT_INSTRUCTION =
  "Identify the main product in this image. Reply with a SHORT phrase (under 12 words) " +
  "naming the product and its key visual traits: color, material, and form. Do NOT " +
  "describe the background, lighting, or photographic style. Output the phrase only.";

/**
 * Build ONE shared style fingerprint from reference image(s). Called ONCE per batch.
 * Degrades to a fixed deterministic template on any failure → uniform style.
 */
export async function buildStyleFingerprint(
  references: Buffer[]
): Promise<string> {
  if (!references || references.length === 0) return FALLBACK_FINGERPRINT;
  try {
    const caption = await visionCaption(FINGERPRINT_INSTRUCTION, references);
    return caption || FALLBACK_FINGERPRINT;
  } catch {
    return FALLBACK_FINGERPRINT;
  }
}

/**
 * Describe ONE product image. Called once per product job.
 * Degrades to a short generic descriptor on any failure.
 */
export async function describeProduct(productImage: Buffer): Promise<string> {
  if (!productImage) return FALLBACK_PRODUCT_DESCRIPTION;
  try {
    const caption = await visionCaption(PRODUCT_INSTRUCTION, [productImage]);
    return caption || FALLBACK_PRODUCT_DESCRIPTION;
  } catch {
    return FALLBACK_PRODUCT_DESCRIPTION;
  }
}

// Instruction for the social copy. We want a real post's text: a short punchy
// headline + a single caption line, in the mood implied by the shared style.
const CAPTION_INSTRUCTION =
  "You write social media copy for a product post. Given the product and the visual " +
  "mood, write a punchy HEADLINE (2-4 words, Title Case) and a single CAPTION line " +
  "(under 12 words, friendly, no hashtags). Reply as strict JSON: " +
  '{"headline": "...", "caption": "..."}. No preamble, JSON only.';

/**
 * Write short social copy (headline + caption) for one product. Called once per job.
 * Uses the same OpenRouter model (text-only here). Degrades to deterministic copy.
 */
export async function writeCaption(
  productDescription: string,
  fingerprint: string,
  productName: string
): Promise<{ headline: string; caption: string }> {
  const prompt =
    `${CAPTION_INSTRUCTION}\n\nProduct: ${productDescription}\nVisual mood: ${fingerprint}`;
  try {
    const raw = await textCompletion(prompt);
    const parsed = parseCopy(raw);
    if (parsed) return parsed;
  } catch {
    // fall through to deterministic copy
  }
  return fallbackCopy(productName, productDescription);
}

function parseCopy(
  raw: string
): { headline: string; caption: string } | undefined {
  if (!raw) return undefined;
  // Tolerate code fences / stray text around the JSON.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const obj = JSON.parse(match[0]) as {
      headline?: unknown;
      caption?: unknown;
    };
    const headline = typeof obj.headline === "string" ? obj.headline.trim() : "";
    const caption = typeof obj.caption === "string" ? obj.caption.trim() : "";
    // Require BOTH fields — a half-parsed object (e.g. only a headline) would render
    // a post with a missing caption line. Better to fall back to deterministic copy.
    if (!headline || !caption) return undefined;
    return { headline: headline.slice(0, 40), caption: caption.slice(0, 120) };
  } catch {
    return undefined;
  }
}

/**
 * Compose the final per-product prompt: shared fingerprint (VERBATIM) + this
 * product's description in the variable slot. Same spine, different subject per card.
 */
export function buildProductPrompt(
  fingerprint: string,
  productDescription: string
): string {
  const subject =
    (productDescription && productDescription.trim()) ||
    FALLBACK_PRODUCT_DESCRIPTION;
  const spine = (fingerprint && fingerprint.trim()) || FALLBACK_FINGERPRINT;
  return `${subject}, presented as a social media product post. ${spine} High quality, professional, cohesive set.`;
}
