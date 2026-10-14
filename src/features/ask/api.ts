"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import type { AskQuery } from "@/shared/lib/report-query";

/** "Ask your data" (17.13): a question → a checked reporting query → leads or numbers. */
export const askKeys = { history: ["ask", "history"] as const };

export type AskAnswer = Schemas["AskAnswer"];
export {
  type AskQuery,
  type Breakdown,
  BREAKDOWNS,
  isMoney,
  isRate,
  type Metric,
  METRICS,
  metricValue,
  PRESETS,
  STAGES,
} from "@/shared/lib/report-query";

export function useAskHistory() {
  return useQuery({ queryKey: askKeys.history, queryFn: () => unwrap(api.GET("/v1/ask/history")) });
}

export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => unwrap(api.POST("/v1/ask", { body: { question } })),
    meta: { silent: true },
    onSuccess: (a) => {
      track("ask.asked", { kind: a.query.kind, answerable: a.answerable });
      void qc.invalidateQueries({ queryKey: askKeys.history });
    },
  });
}

export function useRunQuery() {
  return useMutation({
    mutationFn: (query: AskQuery) => unwrap(api.POST("/v1/ask/run", { body: { query } })),
    meta: { silent: true },
    onSuccess: (a) => track("ask.edited", { kind: a.query.kind }),
  });
}

/** The leads-table URL for a leads answer (the table reads these keys; see leads-table FILTER_KEYS). */
export function leadsHref(a: AskAnswer): string {
  const f = a.query.filters;
  const p = new URLSearchParams();
  if (f.client_id) p.set("client", f.client_id);
  if (f.stages.length) p.set("stage", f.stages.join(","));
  if (f.owner) p.set("owner", f.owner);
  if (f.campaign_id) p.set("campaign", f.campaign_id);
  if (f.overdue) p.set("sla", "overdue");
  if (f.quality) p.set("quality", f.quality);
  if (a.period) {
    p.set("from", a.period.from);
    p.set("to", a.period.to);
  }
  const qs = p.toString();
  return qs ? `/leads?${qs}` : "/leads";
}
