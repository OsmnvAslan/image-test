# DECISIONS.md

What I built, what I deliberately cut, and how the two hard requirements
(reliability and style consistency) are solved. Companion to [PLAN.md](./PLAN.md).

The brief's north star: **"scope it, don't polish it."** Every decision below is in
service of a sharp version that actually ships and runs end-to-end on a reviewer's
machine with zero setup.

---

## What I built

A single-process Next.js app that takes N products + 1–2 references and streams back
N styled social posts, each rendering as it finishes. Four cleanly separated modules
(style, generation, store/orchestration, UI) wired against fixed contracts.

End-to-end verified locally: 4 products + 1 reference → all 4 render progressively,
the concurrency limit (3) is observable (4th product queues), one product's primary
provider was forced to fail and recovered via failover, and all outputs share one
style fingerprint.

---

## The two requirements that mattered

### 1. Reliability at scale

Three layers, smallest blast radius first:

- **Retries with exponential backoff + jitter** per provider (2 retries, base 400ms).
  Transient blips (a slow Pollinations response, a 5xx) self-heal. Observed live: a
  product that failed its first attempt succeeded on attempt 2.
- **Multi-provider failover.** Ordered list `pollinations → together? → mock`. When a
  provider exhausts its retries, generation falls through to the next. `attempts` is
  counted across all providers and surfaced on each card, so failover is visible.
- **Partial-failure isolation.** Each product is its own job in a try/catch inside a
  concurrency pool. One job failing (or one provider being down) never aborts its
  siblings, and the batch always reaches `complete`. The store emits per-job events,
  so a failed card shows its error while the rest keep streaming in.

**The mock provider is load-bearing, on purpose.** It's an always-active final
fallback that never touches the network and returns a deterministic placeholder.
This guarantees the batch never hard-fails in a keyless dry run, and it makes
failover demonstrable without needing a paid second provider. (`GEN_FORCE_FAIL`
forces the primary to fail so a reviewer can watch the failover happen — see README.)

### 2. Style consistency across outputs

The mechanism is **"compute the style once, reuse it verbatim."**

- `buildStyleFingerprint(references)` runs **once per batch** and produces a single
  compact style descriptor (palette, lighting, mood, composition, surface, lens).
- That exact string is stored on the batch and injected into **every** product's
  generation prompt unchanged. Consistency is structural, not probabilistic — there's
  literally one style spine shared by all N prompts.
- `describeProduct(product)` runs per product and supplies only the *subject*, so each
  card is about its own product while sharing the style. The product genuinely drives
  its result (it's not the same image N times).

---

## What I deliberately cut (and why)

| Cut | Why it's fine here |
|-----|--------------------|
| **No DB / persistence** — in-memory `Map` | Batch lifetime is a single session; persistence adds infra with no demo value. State is lost on restart, which is acceptable for a take-home. |
| **No auth** | Out of scope; nothing to protect in a local demo. |
| **No real queue/broker** — in-process async pool | A pool gives the concurrency limit and fan-out the brief asks for. A broker (BullMQ/Redis) is the right call at real scale but is pure infra overhead here. |
| **Not serverless** | In-memory store + long-lived SSE both require one persistent process. A Vercel/serverless deploy would break them (per-request isolation, no shared memory, function timeouts kill SSE). I chose the simpler correct thing — local `next start` — over a serverless rewrite (durable store + polling/websocket service) that the brief doesn't ask for. |
| **Prompt-driven generation, not true img2img** | Free, keyless image APIs are effectively text→image. So the product is captioned to text and fed through the shared style prompt. With a real img2img key this would tighten, but the free path keeps the app runnable for any reviewer. On the free path the raw `productImage` bytes are intentionally unused by the generators. |
| **Vision is optional** | Without `OPENROUTER_API_KEY`, `buildStyleFingerprint` falls back to a fixed style template and `describeProduct` to a generic descriptor. Consistency still holds (the template is identical for all), but per-product variation is reduced. The vision path is wired and ready the moment a key is present. |
| **Minimal tests** | One liveness check per external provider at build time + a full manual end-to-end run. A unit-test suite wasn't worth the half-day budget given explicit "test coverage is low priority" guidance. |
| **Plain Tailwind, no design system** | Clean and legible is enough; polish isn't the evaluated axis. |

---

## Provider choices (and a drift note)

- **Pollinations** (primary, keyless) — the single most important choice: it lets the
  app produce *real* generated images with **zero reviewer setup**. Verified returning
  live JPEGs.
- **Together AI FLUX.1-schnell-Free** (optional real failover) — endpoint verified
  alive; activates only when `TOGETHER_API_KEY` is set, else the mock takes its slot.
- **OpenRouter** vision for captioning — one key powers both fingerprint and product
  description.
- **Model drift caught at build time:** the model originally planned
  (`google/gemini-2.0-flash-exp:free`) was no longer in OpenRouter's free list, so I
  re-queried `/api/v1/models`, confirmed `google/gemma-4-31b-it:free` is live with
  image input, and made it the default (overridable via `OPENROUTER_VISION_MODEL`).
  The style module re-verifies this at build time.

---

## If I had more time

- Real img2img (FLUX/SDXL with image conditioning) for tighter product fidelity.
- A persistent store + reconnectable stream so a refresh doesn't lose a batch.
- Per-provider health/circuit-breaker so a consistently-failing provider is skipped.
- A couple of focused unit tests around the retry/failover state machine.
