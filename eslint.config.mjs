import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "next-env.d.ts",
      "node_modules/**",
      "public/**",
      "src/shared/lib/api/schema.d.ts",
      "storybook-static/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "plugin:jsx-a11y/recommended"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // Features talk to each other only through their index (FRONTEND_PROMPT §4.1).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/features/*/*",
                "!@/features/reports/components/report-document",
                // Shared-report route and mocks: the page alone (not the editor) and the pure grid rules.
                "!@/features/reportbuilder/public-report",
                "!@/features/reportbuilder/grid",
                // The TV route: the page alone, no app code.
                "!@/features/wallboard/tv-page",
              ],
              message: "Import another feature through its index (@/features/<name>).",
            },
          ],
        },
      ],
      // Lead/user content is never rendered as HTML (FRONTEND_PROMPT §11).
      "react/no-danger": "error",
      "jsx-a11y/no-autofocus": "off",
    },
  },
  {
    files: ["src/app/[[]locale[]]/layout.tsx"],
    rules: { "react/no-danger": "off" }, // the static theme bootstrap script (no user content)
  },
);
