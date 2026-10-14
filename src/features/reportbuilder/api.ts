"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

/** Custom report builder (Tier 3, step 8g): widget grids saved as templates, shared and emailed on a schedule. */
export type ReportWidget = Schemas["ReportWidget"];
export type ReportTemplate = Schemas["ReportTemplate"];
export type ReportTemplateInput = Schemas["ReportTemplateInput"];
export type BuilderResult = Schemas["ReportBuilderResult"];
export type WidgetResult = BuilderResult["results"][number];
export type ReportSchedule = Schemas["ReportSchedule"];
export type AskPeriod = Schemas["AskPeriod"];

export const rbKeys = {
  all: ["report-builder"] as const,
  list: ["report-builder", "list"] as const,
  one: (id: string) => ["report-builder", id] as const,
  schedules: (id: string) => ["report-builder", id, "schedules"] as const,
  runs: (id: string) => ["report-builder", id, "runs"] as const,
};

const path = (id: string) => ({ params: { path: { id } } });

export function useTemplates() {
  return useQuery({ queryKey: rbKeys.list, queryFn: () => unwrap(api.GET("/v1/report-templates")) });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: rbKeys.one(id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/report-templates/{id}", path(id!))),
    enabled: !!id,
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ReportTemplateInput }) =>
      id
        ? unwrap(api.PUT("/v1/report-templates/{id}", { ...path(id), body }))
        : unwrap(api.POST("/v1/report-templates", { body })),
    meta: { silent: true },
    onSuccess: (t, { id }) => {
      track(id ? "report_builder.updated" : "report_builder.created", { widgets: t.widgets.length });
      qc.setQueryData(rbKeys.one(t.id), t);
      void qc.invalidateQueries({ queryKey: rbKeys.list });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/report-templates/{id}", path(id))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rbKeys.list }),
  });
}

/** The editor's live preview: the widgets as they are now, for a client (or all) and period. */
export function useRunWidgets(widgets: ReportWidget[], clientId: string, period: AskPeriod) {
  const body = { widgets, client_id: clientId || null, period };
  return useQuery({
    queryKey: ["report-builder", "run", body],
    queryFn: () => unwrap(api.POST("/v1/report-builder/run", { body })),
    enabled: widgets.some((w) => w.query),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: false,
  });
}

export function useShareTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { client_id: string; period: AskPeriod; locale: string }) =>
      unwrap(api.POST("/v1/report-templates/{id}/share", { ...path(id), body })),
    onSuccess: () => {
      track("report_builder.shared");
      void qc.invalidateQueries({ queryKey: rbKeys.runs(id) });
    },
  });
}

export function useRuns(id: string, enabled = true) {
  return useQuery({
    queryKey: rbKeys.runs(id),
    queryFn: () => unwrap(api.GET("/v1/report-templates/{id}/runs", path(id))),
    enabled,
  });
}

export function useSchedules(id: string, enabled = true) {
  return useQuery({
    queryKey: rbKeys.schedules(id),
    queryFn: () => unwrap(api.GET("/v1/report-templates/{id}/schedules", path(id))),
    enabled,
  });
}

export type ScheduleInput = {
  client_id: string;
  cadence: "weekly" | "monthly";
  send_hour: number;
  recipients: string[];
  locale: Schemas["Locale"];
};

export function useCreateSchedule(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleInput) =>
      unwrap(api.POST("/v1/report-templates/{id}/schedules", { ...path(templateId), body })),
    meta: { silent: true },
    onSuccess: (s) => {
      track("report_builder.scheduled", { cadence: s.cadence });
      void qc.invalidateQueries({ queryKey: rbKeys.schedules(templateId) });
    },
  });
}

export function useScheduleAction(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "send-now" | "delete" }) => {
      const p = path(id);
      if (action === "pause") return unwrap(api.POST("/v1/report-schedules/{id}/pause", p));
      if (action === "resume") return unwrap(api.POST("/v1/report-schedules/{id}/resume", p));
      if (action === "send-now") return unwrap(api.POST("/v1/report-schedules/{id}/send-now", p));
      return unwrapEmpty(api.DELETE("/v1/report-schedules/{id}", p));
    },
    onSuccess: (_, { action }) => {
      void qc.invalidateQueries({ queryKey: rbKeys.schedules(templateId) });
      if (action === "send-now") void qc.invalidateQueries({ queryKey: rbKeys.runs(templateId) });
    },
  });
}
