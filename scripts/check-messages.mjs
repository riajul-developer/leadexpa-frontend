// i18n check (FRONTEND_PROMPT §8, GLOBAL_PROMPT G-7): every catalog has exactly en's keys, and every static key
// used in code exists. Generated catalogs (the en-XA pseudo-locale) are skipped.
// Usage: node scripts/check-messages.mjs [--list]   (--list prints the keys found in code)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const catalogs = readdirSync(join(root, "messages"))
  .filter((f) => f.endsWith(".json") && f !== "en-XA.json")
  .map((f) => f.slice(0, -5));
const messages = Object.fromEntries(
  catalogs.map((l) => [l, JSON.parse(readFileSync(join(root, "messages", `${l}.json`), "utf8"))]),
);

function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** Static keys per file: `const t = useTranslations("ns")` / getTranslations({ namespace: "ns" }) then t("key"). */
export function extract(src) {
  // Components in one file rebind the same name (const t = …) — resolve each call against the nearest
  // preceding binding of that name, which matches component scope for sequentially declared components.
  const bindings = [];
  const bind =
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)"|\{[^}]*namespace:\s*"([^"]*)"[^}]*\})?\s*\)/g;
  for (const m of src.matchAll(bind)) bindings.push({ name: m[1], ns: m[2] ?? m[3] ?? "", at: m.index });
  const used = new Set();
  for (const name of new Set(bindings.map((b) => b.name))) {
    const call = new RegExp(`(?<![\\w.])${name}(?:\\.has)?\\(\\s*"([^"]+)"`, "g");
    for (const m of src.matchAll(call)) {
      const b = bindings.filter((x) => x.name === name && x.at < m.index).at(-1);
      if (b) used.add(b.ns ? `${b.ns}.${m[1]}` : m[1]);
    }
  }
  return used;
}

const used = new Set();
for (const f of files(join(root, "src"))) for (const k of extract(readFileSync(f, "utf8"))) used.add(k);

if (process.argv.includes("--list")) {
  console.log([...used].sort().join("\n"));
  process.exit(0);
}

const en = flatten(messages.en);
const problems = [];
for (const l of catalogs.filter((c) => c !== "en")) {
  const other = flatten(messages[l]);
  for (const k of en) if (!other.has(k)) problems.push(`missing in ${l}: ${k}`);
  for (const k of other) if (!en.has(k)) problems.push(`not in en (stale?) in ${l}: ${k}`);
}
// A used key may be a namespace prefix (passed to a child) or a leaf.
const isPrefix = (k, set) => [...set].some((x) => x.startsWith(k + "."));
for (const k of used) if (!en.has(k) && !isPrefix(k, en)) problems.push(`used in code but missing: ${k}`);

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} i18n problem(s).`);
  process.exit(1);
}
console.log(`i18n ok: ${catalogs.join(", ")} × ${en.size} keys, ${used.size} static keys used in code.`);
