// RTL guard (GLOBAL_PROMPT §5.2): physical left/right utilities break Arabic layouts. This script lists them
// (default) or rewrites them to logical ones (--fix): ml→ms, pr→pe, left→start, text-left→text-start,
// border-l→border-s, rounded-l→rounded-s…
// Centering lists ("left-1/2 right-auto -translate-x-1/2") stay physical: they are direction-neutral, while start-*
// combined with a physical translate would push the element off-center in RTL.
// Usage: node scripts/rtl-classes.mjs [--fix]   (exit 1 when unfixed classes remain)
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src");
const fix = process.argv.includes("--fix");

const MAP = [
  [/^(-?)ml-/, "$1ms-"],
  [/^(-?)mr-/, "$1me-"],
  [/^pl-/, "ps-"],
  [/^pr-/, "pe-"],
  [/^(-?)left-/, "$1start-"],
  [/^(-?)right-/, "$1end-"],
  [/^text-left$/, "text-start"],
  [/^text-right$/, "text-end"],
  [/^border-l(-|$)/, "border-s$1"],
  [/^border-r(-|$)/, "border-e$1"],
  [/^rounded-l(-|$)/, "rounded-s$1"],
  [/^rounded-r(-|$)/, "rounded-e$1"],
  [/^rounded-tl(-|$)/, "rounded-ss$1"],
  [/^rounded-tr(-|$)/, "rounded-se$1"],
  [/^rounded-bl(-|$)/, "rounded-es$1"],
  [/^rounded-br(-|$)/, "rounded-ee$1"],
];

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|stories)\./.test(name) && !p.includes("schema.d.ts")) out.push(p);
  }
  return out;
}

/** Converts one class token (with variants like sm:hover:) or returns null when it isn't physical. */
function convert(token, siblings) {
  const parts = token.split(":");
  const base = parts.pop();
  for (const [re, to] of MAP) {
    if (!re.test(base)) continue;
    if (/^-?(left|right)-/.test(base) && siblings.some((s) => /translate-x/.test(s))) return null;
    return [...parts, base.replace(re, to)].join(":");
  }
  return null;
}

let remaining = 0;
let changed = 0;
for (const file of files(ROOT)) {
  const src = readFileSync(file, "utf8");
  // Class lists: className="…", cn("…", "…"), cva variants: any string literal made of class-like tokens.
  const out = src.replace(/(["'`])([^"'`\n]*)\1/g, (lit, q, body) => {
    // Only literals that look like class lists: lowercase utility tokens separated by single spaces.
    if (!/^[\w:./\[\]%!#() -]+$/.test(body) || /\$\{/.test(body)) return lit;
    const tokens = body.split(" ");
    let touched = false;
    const next = tokens.map((t) => {
      const c = convert(t, tokens);
      if (!c) return t;
      touched = true;
      return c;
    });
    if (!touched) return lit;
    if (fix) {
      changed++;
      return q + next.join(" ") + q;
    }
    remaining++;
    console.log(`${file.slice(ROOT.length + 1)}: ${tokens.filter((t, i) => t !== next[i]).join(" ")}`);
    return lit;
  });
  if (fix && out !== src) writeFileSync(file, out);
}
if (fix) console.log(`rtl-classes: rewrote ${changed} class list(s)`);
else if (remaining) {
  console.error(`rtl-classes: ${remaining} class list(s) use physical left/right (run with --fix)`);
  process.exit(1);
} else console.log("rtl-classes ok");
