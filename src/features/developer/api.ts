"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

/** The public API (G5 step 5c): agency API keys and outgoing webhooks with their delivery log. */
export const developerKeys = {
  all: ["developer"] as const,
  catalog: ["developer", "catalog"] as const,
  keys: ["developer", "keys"] as const,
  endpoints: ["developer", "endpoints"] as const,
  deliveries: (endpointId: string, status?: string) => ["developer", "deliveries", endpointId, status ?? null] as const,
  delivery: (id: string) => ["developer", "delivery", id] as const,
};

export type ApiKey = Schemas["ApiKey"];
export type ApiScope = Schemas["ApiScope"];
export type WebhookEndpoint = Schemas["WebhookEndpoint"];
export type WebhookEventType = Schemas["WebhookEventType"];
export type WebhookDelivery = Schemas["WebhookDelivery"];
export type DeliveryStatus = WebhookDelivery["status"];

export function useDeveloperCatalog() {
  return useQuery({
    queryKey: developerKeys.catalog,
    queryFn: () => unwrap(api.GET("/v1/developer/catalog")),
    staleTime: 60 * 60_000,
  });
}

export function useApiKeys() {
  return useQuery({ queryKey: developerKeys.keys, queryFn: () => unwrap(api.GET("/v1/api-keys")) });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: ApiScope[]; expires_at?: string | null }) =>
      unwrap(api.POST("/v1/api-keys", { body })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("api_key.created", { scopes: r.key.scopes.join(",") });
      void qc.invalidateQueries({ queryKey: developerKeys.keys });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/api-keys/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      track("api_key.revoked");
      void qc.invalidateQueries({ queryKey: developerKeys.keys });
    },
  });
}

export function useWebhookEndpoints() {
  return useQuery({ queryKey: developerKeys.endpoints, queryFn: () => unwrap(api.GET("/v1/webhook-endpoints")) });
}

export type EndpointInput = {
  url: string;
  description?: string;
  events: WebhookEventType[];
  client_ids?: string[];
};

export function useCreateEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EndpointInput) => unwrap(api.POST("/v1/webhook-endpoints", { body })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("webhook.created", { events: r.endpoint.events.length });
      void qc.invalidateQueries({ queryKey: developerKeys.endpoints });
    },
  });
}

export function useUpdateEndpoint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<EndpointInput> & { status?: "active" | "disabled" }) =>
      unwrap(api.PATCH("/v1/webhook-endpoints/{id}", { params: { path: { id } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: developerKeys.endpoints }),
  });
}

export function useDeleteEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/webhook-endpoints/{id}", { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: developerKeys.endpoints }),
  });
}

export function useRotateSecret(id: string) {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/webhook-endpoints/{id}/rotate-secret", { params: { path: { id } } })),
  });
}

/** Test and resend answer at once with the delivery (and the receiver's answer). */
export function useTestEndpoint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/webhook-endpoints/{id}/test", { params: { path: { id } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["developer", "deliveries", id] });
      void qc.invalidateQueries({ queryKey: developerKeys.endpoints });
    },
  });
}

export function useDeliveries(endpointId: string, status?: DeliveryStatus) {
  return useQuery({
    queryKey: developerKeys.deliveries(endpointId, status),
    queryFn: () =>
      unwrap(
        api.GET("/v1/webhook-endpoints/{id}/deliveries", {
          params: { path: { id: endpointId }, query: status ? { status } : {} },
        }),
      ),
  });
}

export function useDelivery(id: string | null) {
  return useQuery({
    queryKey: developerKeys.delivery(id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/webhook-deliveries/{id}", { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

export function useReplayDelivery(endpointId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/v1/webhook-deliveries/{id}/replay", { params: { path: { id } } })),
    onSuccess: () => {
      track("webhook.replayed");
      void qc.invalidateQueries({ queryKey: ["developer", "deliveries", endpointId] });
      void qc.invalidateQueries({ queryKey: developerKeys.endpoints });
    },
  });
}
