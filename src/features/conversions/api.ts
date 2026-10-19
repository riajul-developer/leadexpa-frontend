"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

// The realtime bridge invalidates ["conversions"] by literal key.
export const conversionKeys = {
  all: ["conversions"] as const,
  overview: (clientId: string) => ["conversions", "overview", clientId] as const,
  stats: (id: string) => ["conversions", "stats", id] as const,
  events: (id: string, status: string) => ["conversions", "events", id, status] as const,
  google: ["conversions", "google"] as const,
  customers: (connectionId: string) => ["conversions", "google", "customers", connectionId] as const,
  actions: (connectionId: string, customerId: string, login: string) =>
    ["conversions", "google", "actions", connectionId, customerId, login] as const,
  available: (platform: string, connectionId: string) => ["conversions", "available", platform, connectionId] as const,
  adAccounts: (clientId: string) => ["conversions", "ad-accounts", clientId] as const,
};

export type Destination = Schemas["ConversionDestination"];
export type ConversionEvent = Schemas["ConversionEvent"];
export type ConversionStats = Schemas["ConversionStats"];
export type AdAccount = Schemas["AdAccount"];
export type GoogleConnection = Schemas["GoogleConnection"];
export type Platform = Destination["platform"];
export type Health = Destination["health"];

export const TRIGGERS = ["stage.contacted", "stage.qualified", "stage.won", "stage.lost", "sale"] as const;
export type Trigger = (typeof TRIGGERS)[number];

/** "stage.won" → "won" (message keys can't contain dots). */
export const triggerKey = (t: string) => t.replace("stage.", "");

export function useConversions(clientId: string) {
  return useQuery({
    queryKey: conversionKeys.overview(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/conversions", { params: { path: { clientId } } })),
  });
}

export function useSetTerms(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accepted: boolean) =>
      unwrap(
        api.PUT("/v1/clients/{clientId}/conversions/terms", { params: { path: { clientId } }, body: { accepted } }),
      ),
    onSuccess: (s) => {
      track(s.accepted ? "conversions.terms_accepted" : "conversions.terms_withdrawn");
      void qc.invalidateQueries({ queryKey: conversionKeys.overview(clientId) });
    },
  });
}

export type NewDestination = {
  platform: Platform;
  name?: string;
  dataset_id?: string;
  access_token?: string;
  test_event_code?: string;
  google_connection_id?: string;
  customer_id?: string;
  login_customer_id?: string;
  mapping?: Record<string, string>;
  send_value?: boolean;
};

export function useCreateDestination(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewDestination) =>
      unwrap(api.POST("/v1/clients/{clientId}/conversion-destinations", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (d) => {
      track("conversions.destination_created", { platform: d.platform });
      void qc.invalidateQueries({ queryKey: conversionKeys.overview(clientId) });
    },
  });
}

export type DestinationPatch = {
  name?: string;
  status?: "active" | "paused";
  mapping?: Record<string, string>;
  send_value?: boolean;
  test_event_code?: string;
  access_token?: string;
};

export function useUpdateDestination(d: Destination) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DestinationPatch) =>
      unwrap(api.PATCH("/v1/conversion-destinations/{id}", { params: { path: { id: d.id } }, body })),
    meta: { silent: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: conversionKeys.overview(d.client_id) }),
  });
}

export function useDeleteDestination(d: Destination) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/conversion-destinations/{id}", { params: { path: { id: d.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: conversionKeys.overview(d.client_id) }),
  });
}

export function useDestinationStats(id: string) {
  return useQuery({
    queryKey: conversionKeys.stats(id),
    queryFn: () => unwrap(api.GET("/v1/conversion-destinations/{id}/stats", { params: { path: { id } } })),
  });
}

export function useDestinationEvents(id: string, status: "" | ConversionEvent["status"], enabled: boolean) {
  return useQuery({
    queryKey: conversionKeys.events(id, status),
    queryFn: () =>
      unwrap(
        api.GET("/v1/conversion-destinations/{id}/events", {
          params: { path: { id }, query: { status: status || undefined } },
        }),
      ),
    enabled,
  });
}

export function useTestDestination(id: string) {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/conversion-destinations/{id}/test", { params: { path: { id } } })),
    meta: { silent: true },
  });
}

export function useRetryDestination(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/conversion-destinations/{id}/retry", { params: { path: { id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: conversionKeys.all }),
  });
}

export function useGoogle(enabled = true) {
  return useQuery({
    queryKey: conversionKeys.google,
    queryFn: () => unwrap(api.GET("/v1/integrations/google")),
    enabled,
    meta: { silent: true },
  });
}

export function useGoogleCustomers(connectionId: string | undefined) {
  return useQuery({
    queryKey: conversionKeys.customers(connectionId ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/integrations/google/connections/{connectionId}/customers", {
          params: { path: { connectionId: connectionId! } },
        }),
      ),
    enabled: !!connectionId,
    staleTime: 5 * 60_000,
  });
}

export function useGoogleActions(connectionId: string | undefined, customerId: string, login: string) {
  return useQuery({
    queryKey: conversionKeys.actions(connectionId ?? "", customerId, login),
    queryFn: () =>
      unwrap(
        api.GET("/v1/integrations/google/connections/{connectionId}/conversion-actions", {
          params: {
            path: { connectionId: connectionId! },
            query: { customer_id: customerId, login_customer_id: login || undefined },
          },
        }),
      ),
    enabled: !!connectionId && customerId.replace(/-/g, "").length === 10,
    staleTime: 5 * 60_000,
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      unwrapEmpty(
        api.DELETE("/v1/integrations/google/connections/{connectionId}", { params: { path: { connectionId } } }),
      ),
    onSuccess: () => {
      track("integration.google.disconnected");
      void qc.invalidateQueries({ queryKey: conversionKeys.all });
    },
  });
}

export function useAdAccounts(clientId: string) {
  return useQuery({
    queryKey: conversionKeys.adAccounts(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/ad-accounts", { params: { path: { clientId } } })),
  });
}

export function useAvailableAccounts(platform: Platform, connectionId: string | undefined) {
  return useQuery({
    queryKey: conversionKeys.available(platform, connectionId ?? ""),
    queryFn: () =>
      unwrap(api.GET("/v1/integrations/ad-accounts", { params: { query: { platform, connection_id: connectionId } } })),
    enabled: platform === "meta" || !!connectionId,
    meta: { silent: true },
  });
}

export function useLinkAdAccount(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      platform: Platform;
      external_id: string;
      connection_id: string;
      login_customer_id?: string;
    }) => unwrap(api.POST("/v1/clients/{clientId}/ad-accounts", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (a) => {
      track("spend.account_linked", { platform: a.platform });
      void qc.invalidateQueries({ queryKey: conversionKeys.adAccounts(clientId) });
    },
  });
}

export function useAdAccountActions(a: AdAccount) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: conversionKeys.adAccounts(a.client_id) });
  const path = { params: { path: { id: a.id } } };
  return {
    sync: useMutation({
      mutationFn: () => unwrap(api.POST("/v1/ad-accounts/{id}/sync", path)),
      meta: { silent: true },
      onSettled: done,
    }),
    status: useMutation({
      mutationFn: (status: "active" | "paused") =>
        unwrap(api.PATCH("/v1/ad-accounts/{id}", { ...path, body: { status } })),
      onSuccess: done,
    }),
    unlink: useMutation({
      mutationFn: () => unwrapEmpty(api.DELETE("/v1/ad-accounts/{id}", path)),
      onSuccess: done,
    }),
  };
}
