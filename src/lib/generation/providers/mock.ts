import { GenerateInput, ImageProvider } from "@/lib/types";

// MockProvider — FINAL FALLBACK (PLAN §4.3 Provider B fallback). Always active.
// Never makes network calls. Returns a deterministic placeholder SVG (hash-derived
// background color + the productName) as a data:image/svg+xml;base64 URL. Guarantees
// the batch never hard-fails in a dry run and makes failover visibly demonstrable.
// Text-only: input.productImage is unused (scoped free-path behavior).

// Deterministic hue from productName -> stable per-product color.
function hueFromName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class MockProvider implements ImageProvider {
  name = "mock";

  async generate(input: GenerateInput): Promise<string> {
    const hue = hueFromName(input.productName);
    const bg = `hsl(${hue}, 60%, 45%)`;
    const accent = `hsl(${(hue + 40) % 360}, 70%, 75%)`;
    const label = escapeXml(input.productName || "Product");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${bg}"/>
  <circle cx="512" cy="430" r="220" fill="${accent}" opacity="0.85"/>
  <text x="512" y="780" font-family="sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="512" y="850" font-family="sans-serif" font-size="32" fill="#ffffff" opacity="0.8" text-anchor="middle">mock fallback</text>
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
}
