import { GenerateInput, ImageProvider } from "@/lib/types";

// TogetherProvider — FAILOVER (PLAN §4.3 Provider B). VERIFIED LIVE (401 without key).
// Only included in the active provider list when TOGETHER_API_KEY is set (see isActive()).
// Text->image: consumes ONLY stylePrompt. The free path does NOT use input.productImage.

const TOGETHER_TIMEOUT_MS = 60_000;

export class TogetherProvider implements ImageProvider {
  name = "together";

  // Provider is SKIPPED (excluded from the active list) when no key is configured.
  static isActive(): boolean {
    return Boolean(process.env.TOGETHER_API_KEY);
  }

  async generate(input: GenerateInput): Promise<string> {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) {
      throw new Error("together: TOGETHER_API_KEY not set");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOGETHER_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt: input.stylePrompt,
          width: 1024,
          height: 1024,
          n: 1,
          response_format: "b64_json",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`together: HTTP ${res.status}`);
      }

      const json = (await res.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("together: missing data[0].b64_json in response");
      }
      return `data:image/jpeg;base64,${b64}`;
    } finally {
      clearTimeout(timer);
    }
  }
}
