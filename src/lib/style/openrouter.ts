// Style agent — OpenRouter vision client (PLAN.md §4.4, §7).
//
// One vision model powers BOTH style-fingerprint and product-description calls,
// behind a single OPENROUTER_API_KEY. This helper just owns the HTTP plumbing:
// base64 data-URL encoding, the chat-completions request, and a 45s timeout.
// It NEVER swallows errors itself — callers (index.ts) decide to fall back.

// Default model: `nvidia/nemotron-nano-12b-v2-vl:free`. Re-verified live 2026-06-23
// — it reliably captions products, whereas the gemma free models were 429
// (rate-limited upstream) and the llama/qwen free vision tiers were retired (404).
// Free vision endpoints are flaky (429 / "idle timeout"), so visionCaption retries
// a few times before letting the caller fall back. Override via OPENROUTER_VISION_MODEL.
const DEFAULT_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45_000;
const MAX_TRIES = 3; // free endpoints often need a retry or two
const RETRY_BASE_MS = 1_200;

export function getModel(): string {
  return process.env.OPENROUTER_VISION_MODEL || DEFAULT_MODEL;
}

export function getApiKey(): string | undefined {
  const key = process.env.OPENROUTER_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

// Sniff magic bytes for PNG vs JPEG; default to jpeg.
function detectMime(buf: Buffer): string {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

export function toDataUrl(buf: Buffer): string {
  const mime = detectMime(buf);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Single vision call: one text instruction + one-or-more images. Returns the
// model's text reply (trimmed). Throws on no-key, HTTP error, timeout, or empty
// response — the caller is responsible for catching and falling back.
export async function visionCaption(
  instruction: string,
  images: Buffer[]
): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: instruction }];
  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(img) } });
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      return await singleCall(key, content);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_TRIES) {
        await sleep(RETRY_BASE_MS * attempt); // linear backoff: 1.2s, 2.4s
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("OpenRouter vision call failed");
}

// Text-only completion (no image) using the same model + retry behavior. Used for
// writing the social copy. Throws on no-key / HTTP error / timeout / empty — caller
// catches and falls back.
export async function textCompletion(prompt: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const content: Array<{ type: "text"; text: string }> = [
    { type: "text", text: prompt },
  ];

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      return await singleCall(key, content);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_TRIES) await sleep(RETRY_BASE_MS * attempt);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("OpenRouter text call failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function singleCall(
  key: string,
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenRouter HTTP ${res.status}`);
    }

    const data: unknown = await res.json();
    const text = extractText(data);
    if (!text) throw new Error("OpenRouter returned empty content");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const msg = (choices[0] as { message?: { content?: unknown } }).message;
  const content = msg?.content;
  if (typeof content === "string") return content;
  // Some providers return content as an array of parts.
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        typeof p === "object" && p !== null && "text" in p
          ? String((p as { text?: unknown }).text ?? "")
          : ""
      )
      .join(" ")
      .trim();
  }
  return undefined;
}
