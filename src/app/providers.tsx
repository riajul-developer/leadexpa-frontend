"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { initAnalytics } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { initMonitoring } from "@/shared/lib/monitoring";
import { usePlanLimit } from "@/shared/lib/plan-limit";
import { usePreferences } from "@/shared/lib/preferences";
import { meKey } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";

import { MockGate } from "./mock-gate";

// The toast renderer loads after first paint; toasts raised before it mounts are queued by sonner.
const Toaster = dynamic(() => import("sonner").then((m) => m.Toaster), { ssr: false });
// Only fetched the first time a plan limit is hit.
const PlanLimitDialog = dynamic(() => import("@/features/billing").then((m) => m.PlanLimitDialog), { ssr: false });

/** Errors the UI handles specially (plan limits) or locally (validation, conflicts) don't get a generic toast. */
function handledLocally(e: unknown) {
  return (
    isApiError(e) && (e.status === 401 || e.status === 404 || e.status === 409 || e.status === 422 || e.isPlanLimit)
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const t = useTranslations("errors");
  const showPlanLimit = usePlanLimit((s) => s.show);
  const limitHit = usePlanLimit((s) => s.limit !== null);
  const [client] = useState(() => {
    // eslint-disable-next-line prefer-const -- assigned below; onError needs the client it belongs to
    let qc: QueryClient;
    const onError = (e: unknown) => {
      // The agency started requiring two-step sign-in mid-session: /me now reports it and the shell shows the gate.
      // Likewise when it starts allowing only its own networks (G7b): /me reports access_blocked.
      if (isApiError(e) && (e.code === "mfa_required" || e.code === "ip_not_allowed")) {
        void qc.invalidateQueries({ queryKey: meKey });
        return;
      }
      if (isApiError(e) && e.isPlanLimit && e.limit) {
        showPlanLimit(e.limit);
        return;
      }
      // A sandbox refuses anything that would reach a real account or person (G7i): always say so.
      if (isApiError(e) && e.code === "sandbox_unsupported") {
        toast.error(t("sandbox_unsupported"));
        return;
      }
      if (handledLocally(e)) return;
      const code = isApiError(e) ? e.code : "network";
      toast.error(t.has(code) ? t(code) : t("internal"));
    };
    qc = new QueryClient({
      queryCache: new QueryCache({ onError: (e, q) => q.meta?.silent !== true && onError(e) }),
      mutationCache: new MutationCache({ onError: (e, _v, _c, m) => m.meta?.silent !== true && onError(e) }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false, // SSE keeps data fresh; the stream resyncs after gaps
          retry: (n, e) => !(isApiError(e) && e.status < 500) && n < 2,
        },
        mutations: { retry: false },
      },
    });
    return qc;
  });

  // Persisted preferences hydrate after mount (they live in localStorage).
  useEffect(() => {
    void usePreferences.persist.rehydrate();
  }, []);
  const consent = usePreferences((s) => s.analyticsConsent);
  useEffect(() => initAnalytics(consent === true), [consent]);
  useEffect(() => initMonitoring(), []);
  // PWA: offline shell + push. Production only, and never alongside MSW (both workers want scope "/").
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_API_MOCKING === "enabled") return;
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return (
    <MockGate>
      <QueryClientProvider client={client}>
        {children}
        {limitHit && <PlanLimitDialog />}
        <Toaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </MockGate>
  );
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { silent?: boolean };
    mutationMeta: { silent?: boolean };
  }
}
