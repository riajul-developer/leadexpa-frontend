"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";

export const insightKeys = {
  all: ["insights"] as const,
  overview: ["insights", "health"] as const,
  health: (clientId: string) => ["insights", "health", clientId] as const,
  forecast: (clientId: string, weeks: number) => ["insights", "forecast", clientId, weeks] as const,
  attribution: (q: AttributionQuery) => ["insights", "attribution", q] as const,
};

export type ClientHealth = Schemas["ClientHealth"];
export type HealthRow = Schemas["ClientHealthRow"];
export type Anomaly = Schemas["ClientAnomaly"];
export type Forecast = Schemas["Forecast"];
export type Attribution = Schemas["Attribution"];
export type AttributionModel = Attribution["model"];
export const MODELS: AttributionModel[] = ["first_touch", "last_touch", "linear", "position_based", "time_decay"];
export type AttributionQuery = { model: AttributionModel; from: string; to: string; client_id?: string };

export function useHealthOverview() {
  return useQuery({ queryKey: insightKeys.overview, queryFn: () => unwrap(api.GET("/v1/health/clients")) });
}

export function useClientHealth(clientId: string) {
  return useQuery({
    queryKey: insightKeys.health(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/health", { params: { path: { clientId } } })),
  });
}

export function useRefreshHealth(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/clients/{clientId}/health/refresh", { params: { path: { clientId } } })),
    onSuccess: (h) => {
      qc.setQueryData(insightKeys.health(clientId), h);
      void qc.invalidateQueries({ queryKey: insightKeys.overview });
    },
  });
}

export function useDraftUpdate(clientId: string) {
  return useMutation({
    mutationFn: (language: string) =>
      unwrap(
        api.POST("/v1/clients/{clientId}/health/draft-update", { params: { path: { clientId } }, body: { language } }),
      ),
    meta: { silent: true },
    onSuccess: () => track("insights.update_drafted"),
  });
}

export function useForecast(clientId: string | undefined, weeks = 12) {
  return useQuery({
    queryKey: insightKeys.forecast(clientId ?? "", weeks),
    queryFn: () =>
      unwrap(
        api.GET("/v1/clients/{clientId}/forecast", { params: { path: { clientId: clientId! }, query: { weeks } } }),
      ),
    enabled: !!clientId,
  });
}

export function useAttribution(q: AttributionQuery) {
  return useQuery({
    queryKey: insightKeys.attribution(q),
    queryFn: () => unwrap(api.GET("/v1/attribution", { params: { query: q } })),
  });
}
