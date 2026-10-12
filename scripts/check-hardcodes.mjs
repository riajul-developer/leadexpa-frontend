// G-2 guard (GLOBAL_PROMPT §2): no Bangladesh-specific defaults in UI code. Zones, currencies and countries
// come from the user/agency/client (useDisplayTimeZone, useAgencyCurrency, client.timezone…).
// Usage: node scripts/check-hardcodes.mjs   (exit 1 on findings)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src");
const PATTERN = /["'`](Asia\/Dhaka|BDT|BD|\+880\d*)["'`]/;
const ALLOWED = [
  "shared/config/countries.ts", // the country list itself
  "shared/lib/format/", // BD-specific formatting (taka sign, national phone form), applied only to BD data
  "features/billing/", // plan prices are BDT until G3 price books
  "mocks/",
  "shared/lib/api/schema.d.ts",
];

const findings = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.(test|stories)\./.test(name)) {
      const rel = relative(ROOT, p).split(sep).join("/");
      if (ALLOWED.some((a) => rel.startsWith(a))) continue;
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (PATTERN.test(line)) findings.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
  }
}
walk(ROOT);
if (findings.length) {
  console.error(findings.join("\n"));
  console.error(`\n${findings.length} hard-coded country default(s) (GLOBAL_PROMPT G-2).`);
  process.exit(1);
}
console.log("hardcodes ok");
