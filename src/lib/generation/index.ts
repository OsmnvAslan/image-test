import {
  GenerateInput,
  GenerateResult,
  ImageProvider,
} from "@/lib/types";
import { withBackoff } from "./retry";
import { PollinationsProvider } from "./providers/pollinations";
import { TogetherProvider } from "./providers/together";
import { MockProvider } from "./providers/mock";

// Generation module (PLAN §4.3): ordered provider list, exponential backoff + jitter
// per provider (2 retries, base 400ms), failover to the next provider on exhaustion,
// aggregated `attempts` across ALL providers. Throws GenerationError only if every
// active provider fails — in the default config mock is always last, so that path is
// effectively unreachable, but it is kept correct for alternate provider configs.
//
// Free-path note (lead): providers are text->image and consume ONLY stylePrompt
// (+ productName for seeding). input.productImage is intentionally NOT uploaded.

const RETRIES = 2;
const BASE_MS = 400;

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

// Active provider order: pollinations -> (together if key) -> mock.
// Together is skipped entirely when TOGETHER_API_KEY is unset; mock catches everything.
function activeProviders(): ImageProvider[] {
  const providers: ImageProvider[] = [new PollinationsProvider()];
  if (TogetherProvider.isActive()) {
    providers.push(new TogetherProvider());
  }
  providers.push(new MockProvider());
  return providers;
}

export async function generatePost(
  input: GenerateInput,
): Promise<GenerateResult> {
  const providers = activeProviders();
  let attempts = 0; // total attempts across ALL providers
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const imageDataUrl = await withBackoff(() => provider.generate(input), {
        retries: RETRIES,
        baseMs: BASE_MS,
        onAttempt: () => {
          attempts++;
        },
      });
      return { imageDataUrl, provider: provider.name, attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${provider.name}: ${msg}`);
      // failover to the next provider
    }
  }

  throw new GenerationError(
    `All providers failed after ${attempts} attempt(s): ${failures.join(" | ")}`,
  );
}
