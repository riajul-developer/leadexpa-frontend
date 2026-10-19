"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, API_URL, CSRF_COOKIE, readCookie, unwrap, type Schemas } from "@/shared/lib/api/client";
import { toApiError } from "@/shared/lib/api/errors";

export const revKeys = {
  offline: (clientId: string, status?: string) => ["revintel", "offline", clientId, status ?? "all"] as const,
  prediction: (leadId: string) => ["revintel", "prediction", leadId] as const,
  calibration: (clientId: string) => ["revintel", "calibration", clientId] as const,
  benchmarks: (clientId: string) => ["revintel", "benchmarks", clientId] as const,
  benchSettings: ["revintel", "bench-settings"] as const,
};

export type OfflineSale = Schemas["OfflineSale"];
export type OfflineImportResult = Schemas["OfflineImportResult"];
export type DealPrediction = Schemas["DealPrediction"];
export type Benchmarks = Schemas["Benchmarks"];

export function useOfflineSales(clientId: string, status?: "review" | "matched" | "ignored") {
  return useQuery({
    queryKey: revKeys.offline(clientId, status),
    queryFn: () => unwrap(api.GET("/v1/offline-sales", { params: { query: { client_id: clientId, status } } })),
  });
}

export function useUploadOffline(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Multipart: openapi-fetch only serializes JSON, so CSRF + idempotency by hand.
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/v1/clients/${clientId}/offline-sales/csv`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": readCookie(CSRF_COOKIE) ?? "", "Idempotency-Key": crypto.randomUUID() },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw toApiError(res, json);
      return json as OfflineImportResult;
    },
    meta: { silent: true },
    onSuccess: (r) => {
      track("offline_sales.imported", { matched: r.matched, review: r.review });
      void qc.invalidateQueries({ queryKey: ["revintel", "offline", clientId] });
    },
  });
}

export function useResolveOffline(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leadId }: { id: string; leadId?: string }) =>
      unwrap(
        leadId
          ? api.POST("/v1/offline-sales/{saleId}/match", {
              params: { path: { saleId: id } },
              body: { lead_id: leadId },
            })
          : api.POST("/v1/offline-sales/{saleId}/ignore", { params: { path: { saleId: id } } }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["revintel", "offline", clientId] }),
  });
}

export function useLeadPrediction(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: revKeys.prediction(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/prediction", { params: { path: { leadId } } })),
    enabled,
  });
}

export function useCalibration(clientId: string | undefined) {
  return useQuery({
    queryKey: revKeys.calibration(clientId ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/clients/{clientId}/predictions/calibration", {
          params: { path: { clientId: clientId! }, query: { days: 180 } },
        }),
      ),
    enabled: !!clientId,
  });
}

export function useBenchmarks(clientId: string | undefined) {
  return useQuery({
    queryKey: revKeys.benchmarks(clientId ?? ""),
    queryFn: () => unwrap(api.GET("/v1/benchmarks", { params: { query: { client_id: clientId! } } })),
    enabled: !!clientId,
  });
}

export function useBenchSettings() {
  return useQuery({ queryKey: revKeys.benchSettings, queryFn: () => unwrap(api.GET("/v1/benchmarks/settings")) });
}

export function useSetBenchOptIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optIn: boolean) => unwrap(api.PUT("/v1/benchmarks/settings", { body: { opt_in: optIn } })),
    onSuccess: (s) => {
      track("benchmarks.opt_in", { opt_in: s.opt_in });
      qc.setQueryData(revKeys.benchSettings, s);
      void qc.invalidateQueries({ queryKey: ["revintel", "benchmarks"] });
    },
  });
}
