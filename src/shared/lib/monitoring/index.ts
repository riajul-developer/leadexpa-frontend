// Error reporting (FRONTEND_PROMPT §3, §10, §11). Sentry loads lazily (after first paint, and only when a DSN is
// configured), so it never counts against the per-route JS budgets. Every event passes through scrubEvent.
import type * as SentryNs from "@sentry/nextjs";

import { DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./scrub";

type SentryModule = typeof SentryNs;

let loading: Promise<SentryModule | null> | null = null;

function load(): Promise<SentryModule | null> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return Promise.resolve(null);
  loading ??= import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
        dataCollection: DATA_COLLECTION,
        tracesSampleRate: 0,
        // No session replay anywhere: lead screens must never be recorded.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
      return Sentry;
    })
    .catch(() => null);
  return loading;
}

/** Starts the SDK when the browser is idle, so early unhandled errors are still caught. */
export function initMonitoring() {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const start = () => void load();
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 5000 });
  else setTimeout(start, 2000);
}

/** Reports an error and resolves to the Sentry event id (undefined when Sentry is not configured). */
export async function captureError(error: unknown, tags?: Record<string, string>): Promise<string | undefined> {
  const Sentry = await load();
  return Sentry?.captureException(error, tags ? { tags } : undefined);
}

/** Ids only: which user and agency hit the error, never who they are. */
export function setMonitoringUser(userId: string | null, agencyId: string | null) {
  void loading?.then((Sentry) => {
    Sentry?.setUser(userId ? { id: userId } : null);
    Sentry?.setTag("agency_id", agencyId ?? undefined);
  });
}
