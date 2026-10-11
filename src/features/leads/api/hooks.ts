"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useMembers } from "@/shared/lib/lookups";
import { isOffline, useOfflineQueue, type ActivityBody } from "@/shared/lib/offline-queue";
import { inboxKeys, leadKeys, pipelineKeys } from "@/shared/lib/query-keys";
import { toast } from "@/shared/lib/toast";

import type { InboxPage, Lead, LeadDetail, Stage } from "./queries";

export * from "./queries";
export type Outcome = NonNullable<ActivityBody["outcome"]>;

// ---------------------------------------------------------------------------------------------
// Cache helpers: a lead lives in its detail cache, the inbox and lead lists; patch all of them at once.

type Patch = Partial<Lead> | ((l: Lead) => Lead);

function patchLeadEverywhere(qc: QueryClient, id: string, patch: Patch) {
  const apply = (l: Lead): Lead => (typeof patch === "function" ? patch(l) : { ...l, ...patch });
  qc.setQueryData<LeadDetail>(leadKeys.detail(id), (old) => (old ? ({ ...old, ...apply(old) } as LeadDetail) : old));
  // Inbox and lead lists are infinite queries ({ pages: [{ data }] }); inbox rows keep their `section`.
  const patchPages = <P extends { data: Lead[] }>(old: { pages: P[]; pageParams: unknown[] } | undefined) =>
    old?.pages
      ? {
          ...old,
          pages: old.pages.map((p) => ({ ...p, data: p.data.map((l) => (l.id === id ? { ...l, ...apply(l) } : l)) })),
        }
      : old;
  qc.setQueriesData<{ pages: InboxPage[]; pageParams: unknown[] }>({ queryKey: inboxKeys.all }, patchPages);
  qc.setQueriesData<{ pages: { data: Lead[]; next_cursor: string | null }[]; pageParams: unknown[] }>(
    { queryKey: leadKeys.lists() },
    patchPages,
  );
}

interface Snapshot {
  entries: [readonly unknown[], unknown][];
}

async function snapshot(qc: QueryClient, id: string): Promise<Snapshot> {
  await Promise.all([
    qc.cancelQueries({ queryKey: leadKeys.detail(id) }),
    qc.cancelQueries({ queryKey: inboxKeys.all }),
    qc.cancelQueries({ queryKey: leadKeys.lists() }),
  ]);
  return {
    entries: [
      ...qc.getQueriesData({ queryKey: leadKeys.detail(id) }),
      ...qc.getQueriesData({ queryKey: inboxKeys.all }),
      ...qc.getQueriesData({ queryKey: leadKeys.lists() }),
    ],
  };
}

function restore(qc: QueryClient, s: Snapshot | undefined) {
  for (const [key, data] of s?.entries ?? []) qc.setQueryData(key, data);
}

/** Stale version: refetch, then tell the user who changed it (FRONTEND_PROMPT §4.2). */
function useConflictToast() {
  const t = useTranslations("leads.conflict");
  const { byUserId } = useMembers();
  const qc = useQueryClient();
  return async (id: string) => {
    const fresh = await qc.fetchQuery({
      queryKey: leadKeys.detail(id),
      queryFn: () => unwrap(api.GET("/v1/leads/{leadId}", { params: { path: { leadId: id } } })),
    });
    const who = fresh.owner_user_id ? byUserId.get(fresh.owner_user_id)?.user.name : undefined;
    toast.info(who ? t("byName", { name: who }) : t("generic"));
    void qc.invalidateQueries({ queryKey: inboxKeys.all });
  };
}

function settle(qc: QueryClient, id: string) {
  void qc.invalidateQueries({ queryKey: leadKeys.activities(id) });
  void qc.invalidateQueries({ queryKey: inboxKeys.all });
  void qc.invalidateQueries({ queryKey: pipelineKeys.all });
  void qc.invalidateQueries({ queryKey: leadKeys.nextAction(id) });
}

// ---------------------------------------------------------------------------------------------

/**
 * Logs a call/message/note. Optimistic: a response activity marks the SLA met immediately (< 100 ms UI
 * feedback). Offline, the activity is queued with its Idempotency-Key and replayed on reconnect.
 */
export function useLogActivity(lead: Pick<Lead, "id" | "received_at" | "first_response_at" | "stage">) {
  const qc = useQueryClient();
  const t = useTranslations("leads.activity");
  const enqueue = useOfflineQueue((s) => s.enqueue);
  return useMutation({
    mutationFn: async (body: ActivityBody) => {
      if (isOffline()) {
        enqueue(lead.id, body);
        return null;
      }
      return unwrap(api.POST("/v1/leads/{leadId}/activities", { params: { path: { leadId: lead.id } }, body }));
    },
    meta: { silent: true },
    onMutate: async (body) => {
      const snap = await snapshot(qc, lead.id);
      const responds = body.type !== "note" && body.outcome !== "no_answer" && body.outcome !== "busy";
      const now = new Date().toISOString();
      patchLeadEverywhere(qc, lead.id, (l) => ({
        ...l,
        last_activity_at: now,
        first_attempt_at: l.first_attempt_at ?? (body.type !== "note" ? now : null),
        first_response_at: l.first_response_at ?? (responds ? now : null),
        stage: l.stage === "new" && body.type !== "note" ? "contacted" : l.stage,
        next_callback_at:
          body.outcome === "callback_requested" ? (body.callback_at ?? l.next_callback_at) : l.next_callback_at,
        sla: responds && l.sla ? { ...l.sla, status: "met", due_at: null } : l.sla,
      }));
      return snap;
    },
    onSuccess: (res, body) => {
      track("lead.outcome.logged", { type: body.type, outcome: body.outcome ?? null, offline: res === null });
      if (res === null) {
        toast.info(t("queuedOffline"));
        return;
      }
      patchLeadEverywhere(qc, lead.id, res.lead);
    },
    onError: (e, _b, snap) => {
      restore(qc, snap);
      toast.error(isApiError(e) && e.status === 422 ? t("invalid") : t("failed"));
    },
    onSettled: (res) => {
      if (res !== null) settle(qc, lead.id);
    },
  });
}

export interface StageChange {
  to: Stage;
  lost_reason?: string;
  activity?: ActivityBody;
  sale?: Schemas["SaleInput"];
}

export function useChangeStage(lead: Pick<Lead, "id" | "version" | "stage">) {
  const qc = useQueryClient();
  const conflict = useConflictToast();
  const te = useTranslations("errors");
  return useMutation({
    mutationFn: (c: StageChange) =>
      unwrap(
        api.POST("/v1/leads/{leadId}/stage", {
          params: { path: { leadId: lead.id } },
          body: { version: lead.version, ...c },
        }),
      ),
    meta: { silent: true },
    onMutate: async (c) => {
      const snap = await snapshot(qc, lead.id);
      patchLeadEverywhere(qc, lead.id, { stage: c.to, stage_changed_at: new Date().toISOString() });
      return snap;
    },
    onSuccess: (updated, c) => {
      track("lead.stage.changed", { from: lead.stage, to: c.to, with_sale: !!c.sale });
      patchLeadEverywhere(qc, lead.id, updated);
      if (c.sale) void qc.invalidateQueries({ queryKey: leadKeys.sales(lead.id) });
    },
    onError: (e, _c, snap) => {
      restore(qc, snap);
      if (isApiError(e) && e.code === "version_conflict") void conflict(lead.id);
      else if (isApiError(e) && !e.isPlanLimit) toast.error(te.has(e.code) ? te(e.code) : te("internal"));
    },
    onSettled: () => settle(qc, lead.id),
  });
}

export function useAssign(lead: Pick<Lead, "id" | "version">) {
  const qc = useQueryClient();
  const conflict = useConflictToast();
  return useMutation({
    mutationFn: (owner: string | null) =>
      unwrap(
        api.POST("/v1/leads/{leadId}/assign", {
          params: { path: { leadId: lead.id } },
          body: { version: lead.version, owner_user_id: owner },
        }),
      ),
    meta: { silent: true },
    onMutate: async (owner) => {
      const snap = await snapshot(qc, lead.id);
      patchLeadEverywhere(qc, lead.id, { owner_user_id: owner });
      return snap;
    },
    onSuccess: (updated) => patchLeadEverywhere(qc, lead.id, updated),
    onError: (e, _o, snap) => {
      restore(qc, snap);
      if (isApiError(e) && e.code === "version_conflict") void conflict(lead.id);
    },
    onSettled: () => settle(qc, lead.id),
  });
}

export function useRecordSale(lead: Pick<Lead, "id">) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sale, key }: { sale: Schemas["SaleInput"]; key: string }) =>
      unwrap(
        api.POST("/v1/leads/{leadId}/sales", {
          // Required by the API: a double tap or retry must not record two sales.
          params: { path: { leadId: lead.id }, header: { "Idempotency-Key": key } },
          body: sale,
        }),
      ),
    onSuccess: () => {
      track("sale.recorded");
      void qc.invalidateQueries({ queryKey: leadKeys.sales(lead.id) });
      void qc.invalidateQueries({ queryKey: leadKeys.detail(lead.id) });
    },
  });
}

export function useVoidSale(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) => unwrap(api.POST("/v1/sales/{saleId}/void", { params: { path: { saleId } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leadKeys.sales(leadId) }),
  });
}
