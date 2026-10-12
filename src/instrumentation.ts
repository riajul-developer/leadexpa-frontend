// Server-side error reporting (Next.js instrumentation hook). A no-op unless SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is
// set; the SDK is imported only then, so dev and mock builds don't load it.
import type { Instrumentation } from "next";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const [Sentry, { DATA_COLLECTION, scrubBreadcrumb, scrubEvent }] = await Promise.all([
    import("@sentry/nextjs"),
    import("./shared/lib/monitoring/scrub"),
  ]);
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    dataCollection: DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
