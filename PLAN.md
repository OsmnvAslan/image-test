# PLAN.md — Batch Creative Web App

Team lead plan. Agents build strictly against the contracts in §4. Read this whole
file before touching code.

---

## 1. The task (restated)

User uploads **N product images** + **1–2 reference images** (setting/style/mood).
App produces **N social posts**, one per product, all stylized to match the reference.
Each result renders **as it becomes ready** (progressive). Under the hood: retries,
multi-provider failover, partial-failure isolation, and one consistent visual style
across all N outputs.

Scope philosophy from the brief: **scope it, don't polish it.** A sharp scoped-down
version that ships beats a flawless one that doesn't.

---

## 2. Stack & why

- **Next.js 14 (App Router) + TypeScript**, run as a **local single-process server**
  (`next build && next start`, or a long-lived node host) — **not** serverless.
  - Single repo, API routes + React UI in one place → fastest path to end-to-end.
  - This is the brief's own suggestion; framework choice is explicitly low-priority
    for judging, so we don't burn decision budget here.
  - **Run target is deliberately one local process.** The in-memory store (§6) and a
    long-lived SSE stream (§3) require a single persistent process and **would not
    survive a serverless/Vercel deploy** (per-request isolation, no shared memory,
    function timeouts kill SSE). Local `next start` is the supported target; the
    serverless caveat is recorded in DECISIONS.md.
- **Tailwind CSS** for UI — zero-config styling, fast.
- **No database. No auth.** Batch state lives in an in-memory `Map` in the API
  process (see §6). Acceptable per scope; called out in DECISIONS.md.
- **In-process concurrency** (a tiny async pool), not a real queue/broker.

### Image providers (the reliability core)
We need ≥2 providers and the reviewer must be able to run it **without paid keys**.

- **Provider A (primary): Pollinations.ai** — `https://image.pollinations.ai`.
  Keyless, free, returns a generated image directly from a prompt URL. Zero setup
  for the reviewer → the app runs out of the box.
- **Provider B (failover): Together AI FLUX.1 [schnell] free endpoint** OR **fal.ai**,
  enabled only if `TOGETHER_API_KEY` / `FAL_KEY` is present in env. If no key is set,
  Provider B is a **deterministic mock provider** (returns a placeholder styled image)
  so failover is still demonstrable and the batch never hard-fails in a dry run.

> Image-to-image note: free keyless tiers are effectively **prompt-driven** (text→image).
> We feed the product through a vision-derived description + the shared style prompt
> (see Style agent, §7). This keeps the app runnable for free while still honoring
> "product + reference → styled post." If a true img2img key is provided, the
> generation module uses it; otherwise it degrades to prompt-only. This degradation
> is a conscious scope cut, documented in DECISIONS.md.

---

## 3. Architecture

```
Browser (upload products + refs)
   │  POST /api/batch  (multipart: products[], references[])
   ▼
API: create batch
   - derive ONE shared "style fingerprint" from reference image(s)   [Style module]
   - fan-out: one job per product
   - run jobs through a concurrency pool (limit = 3)
   - each job → generation module (retry + failover)
   - store per-job status in in-memory batch store
   │
   ├─ returns { batchId, productCount } immediately
   ▼
Browser: subscribe GET /api/batch/[id]/stream  (SSE)
   - server pushes a job event each time a job flips loading→done/failed
   - card for each product updates independently
```

- **Fan-out**: `products.map(job)` scheduled into the pool.
- **Concurrency**: simple promise pool, `MAX_CONCURRENCY = 3` (configurable). Keeps
  free providers happy and demonstrates the limit without a real broker.
- **Progressive delivery**: **SSE** (`GET /api/batch/[id]/stream`). Chosen over poll
  (cleaner, true push) and over response-streaming (we want per-card granularity and
  a reconnectable channel). One event per job state change + a terminal `done` event.
- **Partial failure**: a job that exhausts retries+failover ends `failed` with an
  error string; siblings are unaffected; batch completes when all jobs are terminal.

---

## 4. CONTRACTS (agents build against these — do not change without lead sign-off)

### 4.1 Shared types (`src/lib/types.ts`)

```ts
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ProductJob {
  id: string;            // job id (== product index-based id)
  productName: string;   // filename or "Product N"
  status: JobStatus;
  imageDataUrl?: string; // result image as data URL (done)
  provider?: string;     // which provider succeeded ("pollinations" | ...)
  attempts: number;      // total generation attempts made
  error?: string;        // present iff status === 'failed'
}

export interface Batch {
  id: string;
  status: 'running' | 'complete';
  styleFingerprint: string;  // the shared style descriptor (see §7)
  jobs: ProductJob[];
  createdAt: number;
}
```

### 4.2 HTTP API

**`POST /api/batch`** — create + start a batch.
- Request: `multipart/form-data`
  - `products`: one or more image files (required, ≥1)
  - `references`: one or two image files (required, 1–2)
- Response `200`: `{ "batchId": string, "productCount": number }`
- Errors: `400 { "error": string }` (no products / no references / >2 refs).

**`GET /api/batch/[id]/stream`** — SSE stream of job updates.
- `Content-Type: text/event-stream`
- Events (each `data:` line is JSON):
  - `{ "type": "init", "batch": Batch }` — full current state on connect.
  - `{ "type": "job", "job": ProductJob }` — a job changed state.
  - `{ "type": "done", "batchId": string }` — all jobs terminal; stream closes.
- 404 if unknown batch id.

**`GET /api/batch/[id]`** — JSON snapshot (poll fallback / debugging): returns `Batch`.

### 4.3 Generation module (`src/lib/generation/index.ts`)

```ts
export interface GenerateInput {
  productImage: Buffer;       // raw product image bytes
  productName: string;
  stylePrompt: string;        // full per-product prompt from Style module
}

export interface GenerateResult {
  imageDataUrl: string;       // generated post as data URL
  provider: string;           // provider that succeeded
  attempts: number;           // attempts across all providers
}

// Throws GenerationError if ALL providers fail after retries.
export function generatePost(input: GenerateInput): Promise<GenerateResult>;
```

- Internally: ordered provider list, each provider tried with **exponential backoff**
  (e.g. 2 retries, base 400ms, jitter). On provider exhaustion → next provider
  (**failover**). Aggregate `attempts`. Each provider implements:

```ts
export interface ImageProvider {
  name: string;
  generate(input: GenerateInput): Promise<string>; // returns image data URL or throws
}
```

### 4.4 Style module (`src/lib/style/index.ts`)

```ts
// Build ONE shared style fingerprint from reference image(s). Called ONCE per batch.
export function buildStyleFingerprint(references: Buffer[]): Promise<string>;

// Describe ONE product image. Called once per product job. Drives per-product content.
export function describeProduct(productImage: Buffer): Promise<string>;

// Compose the final per-product prompt = shared fingerprint + this product's description.
export function buildProductPrompt(fingerprint: string, productDescription: string): string;
```

- **Two axes, decoupled:**
  - `buildStyleFingerprint` → the shared **style spine** (computed once, reused for
    all N). This is the **consistency** axis.
  - `describeProduct` → what makes each output **about its own product**. This is the
    **per-product content** axis. Without it, all N posts would render the same
    subject — the product must visibly drive its result.
- **Per-job flow (Backend agent wires this):**
  `describeProduct(productImage)` → `buildProductPrompt(fingerprint, productDescription)`
  → pass result as `stylePrompt` into `generatePost` (§4.3).
- `buildProductPrompt` keeps the fingerprint **verbatim** and only swaps in the
  product description slot → same style spine, different subject per card.
- **Vision provider:** both `buildStyleFingerprint` and `describeProduct` use the
  **same vision model** behind a single `OPENROUTER_API_KEY` (OpenRouter, default
  model `google/gemma-4-31b-it:free`, verified live 2026-06-23). One key powers both
  calls. Model id read from `OPENROUTER_VISION_MODEL` env, defaulting to that id.
  - **Fallback without the key:**
    - `buildStyleFingerprint` → deterministic style template (fixed palette/lighting/
      mood descriptor) so outputs stay uniform.
    - `describeProduct` → short **generic descriptor** (e.g. `"the product, centered
      hero shot"`); per-product variation is reduced but the pipeline still runs.
  - Both fallbacks are conscious scope cuts, documented in DECISIONS.md.

---

## 5. Agent zones (Step 2)

1. **Frontend agent** — upload UI (products + refs), SSE subscription, per-card
   loading/done/failed states, progressive render. Builds against §4.2 + §4.1.
2. **Backend/API agent** — the 3 routes, batch store, fan-out, concurrency pool.
   Builds against §4.1–4.4. Owns `src/lib/store.ts`, `src/app/api/**`.
3. **Generation/reliability agent** — `src/lib/generation/**`: providers, retry+
   backoff, failover, mock provider. Builds against §4.3.
4. **Style agent** — `src/lib/style/**`: shared fingerprint from references,
   `describeProduct` per product (same vision provider), and per-product prompt
   composition. Builds against §4.4 + §7.

Boundary: agents only touch their own files + the shared `types.ts` (read-only;
lead owns it). Integration is the lead's job (Step 3).

---

## 6. In-memory store (`src/lib/store.ts`, owned by Backend agent)

- `Map<batchId, Batch>` + a per-batch event emitter so SSE can subscribe.
- Helpers: `createBatch`, `getBatch`, `updateJob` (emits), `completeBatch` (emits).
- Lost on server restart — fine for the demo. Documented as a scope cut.

---

## 7. Style consistency + per-product content (the important bit)

Two axes, computed by different calls, combined per job. **Vision provider for both:
OpenRouter, one `OPENROUTER_API_KEY`. Default model `google/gemma-4-31b-it:free`**
(verified live 2026-06-23). The Style agent MUST re-verify the model resolves at
build time and substitute another live free-vision id from `/api/v1/models` if not.

**Axis 1 — style spine (consistency).** On batch create, `buildStyleFingerprint(references)`
runs **once**:
- With the key: caption the reference(s) into a compact style descriptor (palette,
  lighting, mood, composition, surface, lens).
- Without the key: a fixed deterministic style template so output stays uniform.
  (Scope cut, documented.)

That single `fingerprint` is stored on the batch and **reused verbatim** for all N
products → same style spine for every output, consistency by construction not luck.

**Axis 2 — product content (per-product).** For each job, `describeProduct(productImage)`
runs **once per product**:
- With the key: caption the product image into a short subject description (what the
  object is, its color/material/form) using the **same vision model**.
- Without the key: a short **generic descriptor** fallback (`"the product, centered
  hero shot"`). Per-product variation is reduced — documented scope cut.

**Combine.** Per job: `buildProductPrompt(fingerprint, productDescription)` glues the
shared spine (verbatim) to this product's description. Result → `generatePost`.
Net effect: every card shares one visual style, but each shows **its own product**.

---

## 8. Conscious scope cuts (NOT doing)

- No auth, no DB, no persistence across restarts (in-memory only).
- **Not serverless.** In-memory store + long-lived SSE require one persistent local
  process; a Vercel/serverless deploy would break both (§2). Local `next start` only.
- No real job broker/queue — in-process async pool only.
- No true high-fidelity img2img on the free path — prompt-driven generation with
  optional img2img when a key is supplied.
- Without `OPENROUTER_API_KEY`: deterministic style template + generic product
  descriptor (reduced per-product variation). Vision-driven path needs the key.
- No extensive test suite — one or two smoke checks at most.
- No image moderation, no rate-limit dashboards, no multi-tenant concerns.
- No fancy design system — clean, minimal Tailwind.

---

## 9. Definition of done (Step 3 integration)

- Upload 3–5 products + 1 ref → N cards appear, fill in progressively over SSE.
- Killing one provider (or a forced-fail product) → that card shows `failed`,
  the rest still complete. Batch reaches `complete`.
- All outputs share the same style fingerprint (visible consistency).
- `README.md` (how to run) + `DECISIONS.md` (what/why/cuts) written.
