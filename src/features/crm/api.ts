"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

/** Two-way CRM sync (G5 step 5d): connections per client, field rules, stage map, sync log. */
export const crmKeys = {
  all: ["crm"] as const,
  providers: ["crm", "providers"] as const,
  list: (clientId: string) => ["crm", "list", clientId] as const,
  detail: (id: string) => ["crm", "detail", id] as const,
  statuses: (id: string) => ["crm", "statuses", id] as const,
  log: (id: string) => ["crm", "log", id] as const,
};

export type CrmProvider = Schemas["CrmProvider"];
export type CrmProviderKey = Schemas["CrmProviderKey"];
export type CrmConnection = Schemas["CrmConnection"];
export type CrmConnectionDetail = Schemas["CrmConnectionDetail"];
export type CrmFieldRules = Schemas["CrmFieldRules"];
export type CrmFieldRule = Schemas["CrmFieldRule"];
export type CrmStageMap = Schemas["CrmStageMap"];
export type CrmLogEntry = Schemas["CrmSyncLogEntry"];

export const CRM_FIELDS = ["full_name", "email", "phone", "stage", "deal_value"] as const;
export type CrmField = (typeof CRM_FIELDS)[number];
export const STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;

export function useCrmProviders() {
  return useQuery({
    queryKey: crmKeys.providers,
    queryFn: () => unwrap(api.GET("/v1/crm/providers")),
    staleTime: 60 * 60_000,
  });
}

export function useCrmConnections(clientId: string) {
  return useQuery({
    queryKey: crmKeys.list(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/crm-connections", { params: { path: { clientId } } })),
  });
}

export function useCrmConnection(id: string) {
  return useQuery({
    queryKey: crmKeys.detail(id),
    queryFn: () => unwrap(api.GET("/v1/crm-connections/{id}", { params: { path: { id } } })),
  });
}

export function useCrmStatuses(id: string, enabled: boolean) {
  return useQuery({
    queryKey: crmKeys.statuses(id),
    queryFn: () => unwrap(api.GET("/v1/crm-connections/{id}/statuses", { params: { path: { id } } })),
    enabled,
    staleTime: 10 * 60_000,
    meta: { silent: true },
  });
}

export function useCrmLog(id: string) {
  return useQuery({
    queryKey: crmKeys.log(id),
    queryFn: () => unwrap(api.GET("/v1/crm-connections/{id}/log", { params: { path: { id } } })),
  });
}

export function useStartCrmConnect() {
  return useMutation({
    mutationFn: (body: { provider: CrmProviderKey; client_id: string }) =>
      unwrap(api.POST("/v1/crm/connect", { body })),
    meta: { silent: true },
    onSuccess: (_r, v) => track("crm.connect_started", { provider: v.provider }),
  });
}

export function useUpdateCrmConnection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      status?: "active" | "paused";
      fields?: CrmFieldRules;
      stage_map?: CrmStageMap;
      settings?: Record<string, string>;
    }) => unwrap(api.PATCH("/v1/crm-connections/{id}", { params: { path: { id } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: crmKeys.all }),
  });
}

export function useSyncCrmNow(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/crm-connections/{id}/sync", { params: { path: { id } } })),
    onSuccess: (d) => {
      qc.setQueryData(crmKeys.detail(id), d);
      void qc.invalidateQueries({ queryKey: crmKeys.log(id) });
    },
  });
}

export function useDisconnectCrm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/crm-connections/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      track("crm.disconnected");
      void qc.invalidateQueries({ queryKey: crmKeys.all });
    },
  });
}
