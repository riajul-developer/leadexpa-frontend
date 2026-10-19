"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { channelKeys, leadKeys } from "@/shared/lib/query-keys";

const sequenceKeys = {
  all: ["sequences"] as const,
  list: (client?: string) => ["sequences", "list", client ?? null] as const,
  detail: (id: string) => ["sequences", "detail", id] as const,
  report: (id: string) => ["sequences", "report", id] as const,
  preview: (client: string | null, trigger: unknown) => ["sequences", "preview", client, trigger] as const,
  summary: (client: string | undefined, days: number) => ["sequences", "summary", client ?? null, days] as const,
  lead: (leadId: string) => ["sequences", "lead", leadId] as const,
};

export type Sequence = Schemas["Sequence"];
export type SequenceInput = Schemas["SequenceInput"];
export type Trigger = Schemas["SequenceTrigger"];
export type Step = Schemas["SequenceStep"];
export type StepType = Step["type"];
export type Report = Schemas["SequenceReport"];
export type Recovered = Schemas["RecoveredRevenue"];
export type Enrollment = Schemas["SequenceEnrollment"];
export type ExitCondition = NonNullable<SequenceInput["exit_on"]>[number];

export function useSequences(client?: string) {
  return useQuery({
    queryKey: sequenceKeys.list(client),
    queryFn: () => unwrap(api.GET("/v1/sequences", { params: { query: { client_id: client } } })),
  });
}

export function useSequence(id: string | null) {
  return useQuery({
    queryKey: sequenceKeys.detail(id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/sequences/{sequenceId}", { params: { path: { sequenceId: id! } } })),
    enabled: !!id,
  });
}

export function useSequenceReport(id: string) {
  return useQuery({
    queryKey: sequenceKeys.report(id),
    queryFn: () => unwrap(api.GET("/v1/sequences/{sequenceId}/report", { params: { path: { sequenceId: id } } })),
    refetchInterval: 30_000,
  });
}

export function useSaveSequence(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SequenceInput) =>
      id
        ? unwrap(api.PUT("/v1/sequences/{sequenceId}", { params: { path: { sequenceId: id } }, body }))
        : unwrap(api.POST("/v1/sequences", { body })),
    meta: { silent: true },
    onSuccess: (s) => {
      track(id ? "sequence.updated" : "sequence.created", { trigger: s.trigger.kind, steps: s.steps.length });
      qc.setQueryData(sequenceKeys.detail(s.id), s);
      void qc.invalidateQueries({ queryKey: sequenceKeys.all });
    },
  });
}

export function useSetSequenceStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: "active" | "paused" | "archived") =>
      unwrap(api.POST("/v1/sequences/{sequenceId}/status", { params: { path: { sequenceId: id } }, body: { status } })),
    meta: { silent: true },
    onSuccess: (s) => {
      track("sequence.status", { status: s.status });
      qc.setQueryData(sequenceKeys.detail(s.id), s);
      void qc.invalidateQueries({ queryKey: sequenceKeys.all });
    },
  });
}

export function usePreview(client: string | null, trigger: Trigger, enabled: boolean) {
  return useQuery({
    queryKey: sequenceKeys.preview(client, trigger),
    queryFn: () => unwrap(api.POST("/v1/sequences/preview", { body: { client_id: client, trigger } })),
    enabled: enabled && trigger.kind !== "manual",
    staleTime: 30_000,
    retry: false,
  });
}

export function useRecoverySummary(client?: string, days = 90) {
  return useQuery({
    queryKey: sequenceKeys.summary(client, days),
    queryFn: () => unwrap(api.GET("/v1/recovery/summary", { params: { query: { client_id: client, days } } })),
  });
}

export function useLeadEnrollments(leadId: string) {
  return useQuery({
    queryKey: sequenceKeys.lead(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/sequence-enrollments", { params: { path: { leadId } } })),
  });
}

export function useEnroll(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sequenceId: string) =>
      unwrap(
        api.POST("/v1/leads/{leadId}/sequence-enrollments", {
          params: { path: { leadId } },
          body: { sequence_id: sequenceId },
        }),
      ),
    meta: { silent: true },
    onSuccess: () => {
      track("sequence.enrolled_manually");
      void qc.invalidateQueries({ queryKey: sequenceKeys.lead(leadId) });
    },
  });
}

export function useStopEnrollment(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) =>
      unwrapEmpty(api.POST("/v1/sequence-enrollments/{enrollmentId}/stop", { params: { path: { enrollmentId } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sequenceKeys.lead(leadId) });
      void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
    },
  });
}

export function useApprovedTemplates(clientId: string | null) {
  const accounts = useQuery({
    queryKey: channelKeys.client(clientId ?? ""),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/channels", { params: { path: { clientId: clientId! } } })),
    enabled: !!clientId,
  });
  const wa = accounts.data?.data.find((a) => a.channel === "whatsapp" && a.status === "active");
  const templates = useQuery({
    queryKey: channelKeys.templates(wa?.id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/channels/{accountId}/templates", { params: { path: { accountId: wa!.id } } })),
    enabled: !!wa,
  });
  return {
    hasWhatsApp: !!wa,
    hasSms: !!accounts.data?.data.some((a) => a.channel === "sms" && a.status === "active"),
    templates: (templates.data?.data ?? []).filter((x) => x.status === "approved"),
  };
}
