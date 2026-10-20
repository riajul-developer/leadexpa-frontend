import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Messages are precompiled at build time, so the browser gets a format-only runtime without the ICU parser
// (FRONTEND_PROMPT §9 inbox budget). Message files stay plain ICU JSON; scripts/check-messages.mjs reads them as is.
const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: { messages: { path: "./messages", format: "json", locales: "infer", precompile: true } },
});

// Static security headers. The CSP (nonce-based) is set per request in src/middleware.ts.
const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Microphone only for the AI notes dictation feature (same origin).
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
];

const config: NextConfig = {
  // E2E builds into .next-e2e, so a running `next dev` (which owns .next) and the test server never clobber each other.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  experimental: { optimizePackageImports: ["lucide-react", "date-fns", "recharts"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// ANALYZE=1 pnpm build writes bundle reports to .next/analyze (static HTML + JSON stats).
const withAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "1",
  openAnalyzer: false,
  analyzerMode: "json",
});

const app = withAnalyzer(withNextIntl(config));

// Source maps go to Sentry only on release builds that carry SENTRY_AUTH_TOKEN (+ SENTRY_ORG/SENTRY_PROJECT);
// they are deleted from .next afterwards so they are never served. Other builds skip the Sentry plugin entirely.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(app, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      buildTimeInstrumentation: false,
      telemetry: false,
    })
  : app;
