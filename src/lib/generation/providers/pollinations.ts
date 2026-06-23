import { GenerateInput, ImageProvider } from "@/lib/types";

// PollinationsProvider — keyless PRIMARY (PLAN §4.3 Provider A). VERIFIED LIVE 2026-06-23.
// Text->image: consumes ONLY stylePrompt (+ productName for a stable seed). The free
// path does NOT use input.productImage at all — Pollinations is prompt-driven.
//
// Testability hook: GEN_FORCE_FAIL is a comma-separated list of productNames that this
// provider artificially fails on (throws BEFORE any fetch). Lets integration demonstrate
// per-product partial failure + failover to mock without real network errors.

const POLLINATIONS_TIMEOUT_MS = 90_000; // Pollinations can be slow under load (seen 18–46s)

// Stable, non-negative 32-bit seed derived from productName so retries are
// deterministic-ish (same product -> same seed -> reproducible image).
function stableSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function forcedFailNames(): Set<string> {
  return new Set(
    (process.env.GEN_FORCE_FAIL ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export class PollinationsProvider implements ImageProvider {
  name = "pollinations";

  async generate(input: GenerateInput): Promise<string> {
    // GEN_FORCE_FAIL testability hook — throw before touching the network.
    if (forcedFailNames().has(input.productName)) {
      throw new Error(
        `pollinations: forced failure via GEN_FORCE_FAIL for "${input.productName}"`,
      );
    }

    // Seed off the FULL prompt (which now carries the per-product description), not
    // just productName — otherwise products with identical/similar filenames collide
    // on the same seed and Pollinations returns the same image.
    const seed = stableSeed(`${input.productName}::${input.stylePrompt}`);
    // 768x768 is plenty for a social post and noticeably faster than 1024 under
    // load — fewer timeouts means fewer fallbacks to the mock provider.
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(input.stylePrompt)}` +
      `?width=768&height=768&nologo=true&seed=${seed}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POLLINATIONS_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`pollinations: HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) {
        throw new Error("pollinations: empty response body");
      }
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    } finally {
      clearTimeout(timer);
    }
  }
}
