"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { lookupKeys } from "@/shared/lib/lookups";

export const connectorKeys = {
  all: ["connectors"] as const,
  catalog: ["connectors", "catalog"] as const,
  installs: (clientId?: string) => ["connectors", "installs", clientId ?? null] as const,
  detail: (id: string) => ["connectors", "detail", id] as const,
};

export type ConnectorManifest = Schemas["ConnectorManifest"];
export type ConnectorInstall = Schemas["ConnectorInstall"];
export type ConnectorInstallDetail = Schemas["ConnectorInstallDetail"];
export type ConnectorCredentials = Schemas["ConnectorCredentials"];
export type ConnectorDelivery = Schemas["ConnectorDelivery"];
export type ConnectorHealth = ConnectorInstall["health"];

export function useConnectorCatalog() {
  return useQuery({
    queryKey: connectorKeys.catalog,
    queryFn: () => unwrap(api.GET("/v1/connectors")),
    staleTime: 60 * 60_000,
  });
}

export function useConnectorInstalls(clientId?: string) {
  return useQuery({
    queryKey: connectorKeys.installs(clientId),
    queryFn: () => unwrap(api.GET("/v1/connector-installs", { params: { query: { client_id: clientId } } })),
  });
}

export function useConnectorInstall(id: string) {
  return useQuery({
    queryKey: connectorKeys.detail(id),
    queryFn: () => unwrap(api.GET("/v1/connector-installs/{id}", { params: { path: { id } } })),
  });
}

export function useCreateConnectorInstall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { connector: string; client_id: string; name?: string }) =>
      unwrap(api.POST("/v1/connector-installs", { body })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("connector.installed", { connector: r.install.connector });
      void qc.invalidateQueries({ queryKey: connectorKeys.all });
      void qc.invalidateQueries({ queryKey: lookupKeys.sources(r.install.client_id) });
    },
  });
}

export function useUpdateConnectorInstall(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      status?: "active" | "paused";
      field_map?: Record<string, string>;
      settings?: Record<string, string>;
    }) => unwrap(api.PATCH("/v1/connector-installs/{id}", { params: { path: { id } }, body })),
    meta: { silent: true },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: connectorKeys.all });
      void qc.invalidateQueries({ queryKey: lookupKeys.sources(r.client_id) });
    },
  });
}

export function useRotateConnectorInstall(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/connector-installs/{id}/rotate", { params: { path: { id } } })),
    onSuccess: (r) => {
      track("connector.rotated", { connector: r.install.connector });
      void qc.invalidateQueries({ queryKey: connectorKeys.detail(id) });
    },
  });
}

export function useRemoveConnectorInstall(id: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/connector-installs/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      track("connector.removed");
      qc.removeQueries({ queryKey: connectorKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: connectorKeys.all });
      void qc.invalidateQueries({ queryKey: lookupKeys.sources(clientId) });
    },
  });
}
