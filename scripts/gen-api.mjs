// Generates src/shared/lib/api/schema.d.ts from the backend's OpenAPI spec.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "yaml";

const specPath = process.argv[2] ?? "../backend/api/openapi.yaml";
const spec = parse(readFileSync(specPath, "utf8"));

const isCsrf = (p) =>
  p?.$ref === "#/components/parameters/CSRFToken" ||
  p?.$ref === "#/components/parameters/CSRFTokenCookie" ||
  (p?.in === "header" && p?.name === "X-CSRF-Token");
for (const item of Object.values(spec.paths ?? {})) {
  for (const op of [item, ...Object.values(item)]) {
    if (op && Array.isArray(op.parameters)) op.parameters = op.parameters.filter((p) => !isCsrf(p));
  }
}

// Free-form objects become Record<string, unknown>, not Record<string, never>.
(function openObjects(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(openObjects);
  if (
    node.type === "object" &&
    !node.properties &&
    node.additionalProperties === undefined &&
    !node.allOf &&
    !node.oneOf
  ) {
    node.additionalProperties = true;
  }
  Object.values(node).forEach(openObjects);
})(spec);

const out = join(mkdtempSync(join(tmpdir(), "recov-api-")), "openapi.json");
writeFileSync(out, JSON.stringify(spec));
execFileSync(
  process.execPath,
  ["node_modules/openapi-typescript/bin/cli.js", out, "-o", "src/shared/lib/api/schema.d.ts"],
  { stdio: "inherit" },
);
