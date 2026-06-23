// Shared contract types — OWNED BY TEAM LEAD. Agents import from here, read-only.
// Mirrors PLAN.md §4.1. Do not edit in agent zones.

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface ProductJob {
  id: string; // job id (index-based per batch)
  productName: string; // filename or "Product N"
  status: JobStatus;
  imageDataUrl?: string; // result image as data URL (present iff status === 'done')
  provider?: string; // which provider succeeded ("pollinations" | "together" | "mock")
  attempts: number; // total generation attempts across providers
  error?: string; // present iff status === 'failed'
}

export interface Batch {
  id: string;
  status: "running" | "complete";
  styleFingerprint: string; // the shared style descriptor reused for every product
  jobs: ProductJob[];
  createdAt: number;
}

// ---- SSE event envelope (PLAN.md §4.2) ----
export type StreamEvent =
  | { type: "init"; batch: Batch }
  | { type: "job"; job: ProductJob }
  | { type: "done"; batchId: string };

// ---- Generation module contract (PLAN.md §4.3) ----
export interface GenerateInput {
  productImage: Buffer; // raw product image bytes (UNUSED on the free text->image path)
  productName: string;
  stylePrompt: string; // full per-product prompt from the Style module
}

export interface GenerateResult {
  imageDataUrl: string; // generated post as data URL
  provider: string; // provider that succeeded
  attempts: number; // attempts across all providers
}

export interface ImageProvider {
  name: string;
  generate(input: GenerateInput): Promise<string>; // returns image data URL or throws
}
