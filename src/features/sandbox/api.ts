"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { inboxKeys, leadKeys } from "@/shared/lib/query-keys";
import { realtime } from "@/shared/lib/realtime";
import { useMe } from "@/shared/lib/session";

export type SandboxView = Schemas["SandboxView"];
export const sandboxKey = ["sandbox"] as const;
/** Synthetic leads, and masked copies of the agency's latest real leads (ADR 0058). */
export type SandboxSeed = { leads: number; real_leads: number };
export type SandboxPromoteView = Schemas["SandboxPromoteView"];
export type SandboxChange = SandboxPromoteView["changes"][number];
const promoteKey = ["sandbox", "promote"] as const;

export function useSandboxOf(): string | null {
  const { data: me } = useMe();
  return me?.agency?.sandbox_of ?? null;
}

export function useSandbox(enabled = true) {
  return useQuery({
    queryKey: sandboxKey,
    queryFn: () => unwrap(api.GET("/v1/agencies/current/sandbox")),
    enabled,
  });
}

export function useSandboxActions() {
  const qc = useQueryClient();
  const set = (v: SandboxView) => qc.setQueryData(sandboxKey, v);
  return {
    create: useMutation({
      mutationFn: (body: SandboxSeed) => unwrap(api.POST("/v1/agencies/current/sandbox", { body })),
      meta: { silent: true },
      onSuccess: set,
    }),
    reset: useMutation({
      mutationFn: (body: SandboxSeed) => unwrap(api.POST("/v1/agencies/current/sandbox/reset", { body })),
      meta: { silent: true },
      onSuccess: set,
    }),
    remove: useMutation({
      mutationFn: () => unwrapEmpty(api.DELETE("/v1/agencies/current/sandbox")),
      onSuccess: () =>
        qc.setQueryData(sandboxKey, (old: SandboxView | undefined) => (old ? { ...old, sandbox: null } : old)),
    }),
  };
}

/** What promote would apply from the sandbox to the live workspace (ADR 0059). */
export function usePromotePreview() {
  return useQuery({
    queryKey: promoteKey,
    queryFn: () => unwrap(api.GET("/v1/agencies/current/sandbox/promote")),
    staleTime: 0,
  });
}

export function usePromote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Pick<SandboxChange, "kind" | "sandbox_id">[]) =>
      unwrap(api.POST("/v1/agencies/current/sandbox/promote", { body: { changes } })),
    meta: { silent: true },
    onSuccess: (v) => {
      qc.setQueryData(promoteKey, v);
      // Rules, sequences, responders and SLA policies changed in the live workspace.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "sandbox" });
    },
  });
}

export function useSwitchWorkspace() {
  const qc = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: (agency_id: string) => unwrap(api.POST("/v1/session/agency", { body: { agency_id } })),
    onSuccess: () => {
      realtime.stop();
      qc.clear();
      window.location.assign(`/${locale}/inbox`);
    },
  });
}

export function useAddTestLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => unwrap(api.POST("/v1/sandbox/leads", { body: { count } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
      void qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useSimulateReply(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      unwrapEmpty(api.POST("/v1/sandbox/leads/{leadId}/reply", { params: { path: { leadId } }, body: { text } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.conversations(leadId) }),
  });
}
