// Per-route JS budgets (FRONTEND_PROMPT §9), checked against the last `next build`. Fails (exit 1) on regression.
// A route's first-load JS = the union of chunks for its page and every ancestor layout, gzipped at level 9 (as
// gzip-size / size-limit measure). Next's own "First Load JS" column leaves out route-group layout chunks, which
// the browser still downloads.
// Lazy chunks (overlays, charts, dnd-kit, CSV parser, the MSW worker) are not in the manifest entries, by design.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = join(import.meta.dirname, "..");
const NEXT = join(ROOT, ".next");
const KB = 1024;

/** KB gzipped: §9 budgets for inbox, public report and dashboard; 250 KB (the dashboard figure) for the rest. */
const BUDGETS = {
  "/[locale]/(app)/inbox/page": 170,
  "/[locale]/r/[token]/page": 120,
  // No-login action link (17.0.3): the public-report budget. Next + React alone are ~105 KB (see the print route);
  // the page itself adds ~13 KB (plain fetch, one namespace, no query client or shell).
  "/[locale]/t/[token]/page": 120,
  // Lite app for client staff (17.0.3). The prompt asks for 90 KB, below the ~105 KB that Next + React alone weigh,
  // so it gets the action-link budget: plain fetch, one message namespace, no query client or shell.
  "/[locale]/lite/page": 120,
  "/[locale]/lite/login/page": 120,
  "/[locale]/lite/leads/[leadId]/page": 120,
  // Wallboard TV (8h): TVs and streaming sticks are slow; plain fetch, one namespace, no query client or shell.
  "/[locale]/tv/page": 120,
  "/[locale]/(app)/dashboard/page": 250,
  "/[locale]/(auth)/login/page": 250,
  "/[locale]/(app)/leads/page": 250,
  "/[locale]/(app)/leads/[leadId]/page": 250,
  "/[locale]/(app)/pipeline/page": 250,
  "/[locale]/(app)/clients/[clientId]/[[...tab]]/page": 250,
  "/[locale]/(app)/settings/[tab]/page": 250,
  "/[locale]/(onboarding)/onboarding/[step]/page": 250,
  "/print/reports/[reportId]/page": 120,
};

/** The web-form embed script (§11): ≤ 5 KB gzipped. */
const EMBED = { file: join(ROOT, "public", "embed", "v1.js"), limit: 5 };
/** The OTP step the embed loads on demand (17.0.1): ≤ 4 KB gzipped. */
const EMBED_OTP = { file: join(ROOT, "public", "embed", "otp-v1.js"), limit: 4 };

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(NEXT, "app-build-manifest.json"), "utf8")).pages;
} catch {
  console.error("No .next/app-build-manifest.json: run `pnpm build` first.");
  process.exit(1);
}

const gz = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const sizes = new Map();
function chunkSize(file) {
  if (!sizes.has(file)) sizes.set(file, gz(join(NEXT, file)));
  return sizes.get(file);
}

/** "/[locale]/(app)/inbox/page" → ["/[locale]/layout", "/[locale]/(app)/layout", "/[locale]/(app)/inbox/layout"]. */
function layouts(entry) {
  const parts = entry.split("/").slice(1, -1);
  return parts.map((_, i) => "/" + parts.slice(0, i + 1).join("/") + "/layout");
}

let failed = false;
const rows = [];
function report(route, kb, budget) {
  if (kb > budget) failed = true;
  rows.push({ route, "gz KB": kb.toFixed(1), budget, status: kb > budget ? "OVER" : "ok" });
}

for (const [entry, budget] of Object.entries(BUDGETS)) {
  if (!manifest[entry]) {
    console.error(`Budgeted route missing from the build: ${entry}`);
    failed = true;
    continue;
  }
  const files = new Set();
  for (const key of [...layouts(entry), entry])
    for (const f of manifest[key] ?? []) if (f.endsWith(".js")) files.add(f);
  report(entry.replace(/\/page$/, ""), [...files].reduce((sum, f) => sum + chunkSize(f), 0) / KB, budget);
}
report("public/embed/v1.js", gz(EMBED.file) / KB, EMBED.limit);
report("public/embed/otp-v1.js", gz(EMBED_OTP.file) / KB, EMBED_OTP.limit);

console.table(rows);
if (failed) {
  console.error("JS budget exceeded (FRONTEND_PROMPT §9, docs/adr/0001). Lazy-load it or record an ADR.");
  process.exit(1);
}
