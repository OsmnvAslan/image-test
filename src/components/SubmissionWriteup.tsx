// Presentational write-up: the three submission sections
// (1) The product, (2) How it was built, (3) The code.
// Used both at the bottom of the main app page (/) and on the standalone
// /submission landing. No client hooks — safe in a server or client tree.

const REPO = "https://github.com/OsmnvAslan/image-test";

export default function SubmissionWriteup({
  showExample = true,
}: {
  showExample?: boolean;
}) {
  return (
    <div className="text-slate-300 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-cyan-200 [&_b]:text-slate-100">
      {/* ───────────────── 1. The product ───────────────── */}
      <Section index="1" title="The product">
        <p>
          A working Next.js app that does the task end-to-end. You upload product
          images plus a reference (setting / style / mood); the app generates one
          social post per product — a styled image with an AI-written headline and
          caption — and streams each result to the page as it finishes.
        </p>

        {showExample && (
          <figure className="my-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/example-post.svg"
              alt="Example generated social post: a white sneaker on a warm minimalist studio background with an overlaid headline and caption."
              className="w-full max-w-sm rounded-2xl border border-white/10 shadow-[0_0_40px_-12px_rgba(34,211,238,0.5)]"
            />
            <figcaption className="mt-2 text-sm text-slate-500">
              One generated post: real image (Pollinations) + AI social copy
              overlaid as crisp HTML text.
            </figcaption>
          </figure>
        )}

        <ul className="ml-5 list-disc space-y-2">
          <li>
            <b>Progressive delivery</b> — the POST returns a <code>batchId</code>{" "}
            immediately; the page subscribes over <b>SSE</b> and updates each card
            independently (pending → running → done | failed).
          </li>
          <li>
            <b>Reliability at scale</b> — per-product jobs in a concurrency-limited
            pool, per-provider retries with exponential backoff, failover across{" "}
            <code>Pollinations → Together → mock</code>, and partial-failure
            isolation so one failure never sinks the batch.
          </li>
          <li>
            <b>Style consistency</b> — a single vision-derived{" "}
            <i>style fingerprint</i> is computed <b>once</b> per batch and reused
            verbatim for every product; a per-product description supplies the
            subject. Same style spine, different product per card.
          </li>
          <li>
            <b>Runs with zero paid keys</b> — keyless Pollinations + an always-on
            mock fallback. An OpenRouter key turns on the vision + copy path.
          </li>
        </ul>
      </Section>

      {/* ─────────────── 2. How it was built ─────────────── */}
      <Section index="2" title="How it was built">
        <h3 className="mb-2 mt-2 font-semibold text-slate-100">How I used AI</h3>
        <p>
          I worked in <b>agent-teams</b> mode: acting as team lead, I wrote a{" "}
          <code>PLAN.md</code> with exact contracts (shared types, 3 HTTP
          endpoints, the generation- and style-module interfaces), then deployed{" "}
          <b>4 parallel subagents</b> by zone — frontend, backend/orchestration,
          generation/reliability, and style — each building only against its
          contract. I owned the shared types as the single source of truth.
        </p>
        <p className="mt-3">
          <b>Where I stepped in:</b> I revised the plan before launching the team
          (added a per-product description so the product genuinely drives each
          result; pinned the run target to a single local process). I did the
          integration, the end-to-end runs, and the manual testing.
        </p>
        <p className="mt-3">
          <b>What the AI got wrong / what I overrode:</b>
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-2">
          <li>
            <b>The duplicate-image bug I caught by testing:</b> without a working
            vision model, every product got the same generic description →
            identical prompts → identical images. The AI had designed a fallback
            that was “correct but useless.”
          </li>
          <li>
            <b>Model drift:</b> the model in the plan
            (<code>gemini-2.0-flash-exp:free</code>) had vanished from
            OpenRouter’s free list; later the chosen <code>gemma</code> model began
            returning <code>429</code>. I overrode the AI’s pick and switched to{" "}
            <code>nemotron-nano-12b-v2-vl:free</code>, adding retries since free
            endpoints don’t answer on the first try.
          </li>
          <li>
            <b>Seed collision:</b> the Pollinations seed depended only on the
            filename; I changed it to seed off the full prompt.
          </li>
          <li>
            <b>Review fixes:</b> a self-review found the fallback copy collapsed
            “Product 2” → “2” and “image.png” → garbled text; I hardened it.
          </li>
        </ul>

        <h3 className="mb-2 mt-6 font-semibold text-slate-100">Toolset</h3>
        <div className="overflow-hidden rounded-2xl glass">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tool</th>
                <th className="px-4 py-2.5 font-medium">For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {TOOLS.map((t) => (
                <tr key={t.name} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 font-medium text-cyan-200">
                    {t.name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{t.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-6 font-semibold text-slate-100">
          Time breakdown
        </h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <b>Total:</b> ~3h 25m
          </li>
          <li>
            <b>My hands-on time</b> (planning, contracts, prompts, review, manual
            testing, UI/visual design, directing): <b>~1h 30m</b>
          </li>
          <li>
            <b>AI/LLM working time</b> (code generation, vision/image calls,
            builds): <b>~1h 55m</b>
          </li>
        </ul>
      </Section>

      {/* ───────────────── 3. The code ───────────────── */}
      <Section index="3" title="The code">
        <p>Public GitHub repository:</p>
        <a
          href={REPO}
          className="group mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-mono text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-100"
        >
          <span className="text-cyan-400 transition group-hover:translate-x-0.5">→</span>
          {REPO.replace("https://", "")}
        </a>
        <p className="mt-4 text-sm text-slate-400">
          Layout: <code>src/lib/style/</code> (consistency),{" "}
          <code>src/lib/generation/</code> (reliability),{" "}
          <code>src/lib/store.ts</code> + <code>src/app/api/</code> (orchestration
          + SSE), <code>src/app/page.tsx</code> (UI). Docs: <code>README.md</code>{" "}
          (run), <code>DECISIONS.md</code> (built / cut / why), <code>PLAN.md</code>{" "}
          (contracts).
        </p>
      </Section>
    </div>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold text-slate-100">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-violet-500 to-fuchsia-500 text-base font-black text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.9)]">
          {index}
        </span>
        {title}
      </h2>
      <div className="space-y-2 leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

const TOOLS: { name: string; use: string }[] = [
  {
    name: "Claude Code (CLI agent)",
    use: "Main environment: subagent orchestration, code, integration, run/verify",
  },
  {
    name: "Claude Opus 4.8",
    use: "Team-lead reasoning, prompts, review, debugging",
  },
  {
    name: "4 subagents (agent teams)",
    use: "Frontend / Backend / Generation-reliability / Style, each vs a contract",
  },
  { name: "Preview MCP", use: "Dev server, screenshots, UI verification" },
  { name: "Pollinations.ai", use: "Primary keyless image generation" },
  {
    name: "OpenRouter (nemotron-vl:free)",
    use: "Vision: style fingerprint, product description, social copy",
  },
  {
    name: "Together AI FLUX (free)",
    use: "Optional second image provider (failover)",
  },
  {
    name: "Next.js 14 + TS + Tailwind",
    use: "App stack (App Router, API routes, SSE)",
  },
  { name: "gh CLI / git", use: "Repo + push (without .env)" },
];
