// Lists physical left/right utilities, or rewrites them to logical ones (--fix).
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

function convert(token, siblings) {
  const parts = token.split(":");
  const base = parts.pop();
  for (const [re, to] of MAP) {
    if (!re.test(base)) continue;
    // Centering stays physical: start-* with a physical translate is off-center in RTL.
    if (/^-?(left|right)-/.test(base) && siblings.some((s) => /translate-x/.test(s))) return null;
    return [...parts, base.replace(re, to)].join(":");
  }
  return null;
}

let remaining = 0;
let changed = 0;
for (const file of files(ROOT)) {
  const src = readFileSync(file, "utf8");
  const out = src.replace(/(["'`])([^"'`\n]*)\1/g, (lit, q, body) => {
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
