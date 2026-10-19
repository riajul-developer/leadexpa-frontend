"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { lookupKeys } from "@/shared/lib/lookups";

export type SSOConnectionView = Schemas["SSOConnectionView"];
export type SSOConnection = Schemas["SSOConnection"];
export type SSOConnectionInput = Schemas["SSOConnectionInput"];
export type SSODomain = Schemas["SSODomain"];
export type SCIMToken = Schemas["SCIMTokenInfo"];
export type SCIMTokenCreated = Schemas["SCIMTokenCreated"];

export const ssoConnectionKey = ["sso", "connection"] as const;
export const ssoDomainsKey = ["sso", "domains"] as const;
export const scimTokensKey = ["sso", "scim-tokens"] as const;

export function useSSOConnection() {
  return useQuery({ queryKey: ssoConnectionKey, queryFn: () => unwrap(api.GET("/v1/sso/connection")) });
}

export function useSSODomains() {
  return useQuery({ queryKey: ssoDomainsKey, queryFn: () => unwrap(api.GET("/v1/sso/domains")) });
}

export function useSCIMTokens() {
  return useQuery({ queryKey: scimTokensKey, queryFn: () => unwrap(api.GET("/v1/sso/scim-tokens")) });
}

export function useSaveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SSOConnectionInput) => unwrap(api.PUT("/v1/sso/connection", { body })),
    meta: { silent: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ssoConnectionKey }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/sso/connection")),
    onSuccess: () => qc.invalidateQueries({ queryKey: ssoConnectionKey }),
  });
}

export type SAMLSPCert = Schemas["SAMLSPCert"];

export function useRotateSPKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/sso/connection/sp-key/rotate")),
    meta: { silent: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ssoConnectionKey }),
  });
}

export function useDomainActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ssoDomainsKey });
  const add = useMutation({
    mutationFn: (domain: string) => unwrap(api.POST("/v1/sso/domains", { body: { domain } })),
    meta: { silent: true },
    onSuccess: refresh,
  });
  const verify = useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/v1/sso/domains/{id}/verify", { params: { path: { id } } })),
    meta: { silent: true },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/sso/domains/{id}", { params: { path: { id } } })),
    onSuccess: refresh,
  });
  return { add, verify, remove };
}

export function useTokenActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: scimTokensKey });
  const create = useMutation({
    mutationFn: (name: string) => unwrap(api.POST("/v1/sso/scim-tokens", { body: { name } })),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/sso/scim-tokens/{id}", { params: { path: { id } } })),
    onSuccess: refresh,
  });
  return { create, revoke };
}

export type SSOGroupMapping = Schemas["SSOGroupMapping"];
export type MappableRole = NonNullable<SSOGroupMapping["role"]>;
export const ssoGroupsKey = ["sso", "groups"] as const;

export function useSSOGroups() {
  return useQuery({ queryKey: ssoGroupsKey, queryFn: () => unwrap(api.GET("/v1/sso/groups")) });
}

export function useMapGroupRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: MappableRole | null }) =>
      unwrap(api.PUT("/v1/sso/groups/{id}/role", { params: { path: { id } }, body: { role } })),
    meta: { silent: true },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ssoGroupsKey });
      qc.invalidateQueries({ queryKey: lookupKeys.members });
    },
  });
}

export function startSSO(email: string, returnTo: string | null, locale: string) {
  return unwrap(
    api.POST("/v1/auth/sso/start", { body: { email, locale, ...(returnTo ? { return_to: returnTo } : {}) } }),
  ).then((r) => r.redirect_url);
}

export function finishOIDC(code: string, state: string) {
  return unwrap(api.POST("/v1/auth/sso/oidc/callback", { body: { code, state } }));
}

export type AccessPolicy = Schemas["AccessPolicy"];
export const accessPolicyKey = ["access-policy"] as const;

export function useAccessPolicy() {
  return useQuery({
    queryKey: accessPolicyKey,
    queryFn: () => unwrap(api.GET("/v1/agencies/current/access-policy")),
  });
}

export function useSaveAccessPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      ip_allowlist: string[];
      session_max_hours: number | null;
      session_idle_minutes: number | null;
    }) => unwrap(api.PUT("/v1/agencies/current/access-policy", { body })),
    meta: { silent: true },
    onSuccess: (p) => qc.setQueryData(accessPolicyKey, p),
  });
}

export type EncryptionKeys = Schemas["EncryptionKeys"];
export const encryptionKeysKey = ["encryption-keys"] as const;

export function useEncryptionKeys() {
  return useQuery({
    queryKey: encryptionKeysKey,
    queryFn: () => unwrap(api.GET("/v1/agencies/current/encryption-keys")),
  });
}

export function useEncryptionKeyActions() {
  const qc = useQueryClient();
  const set = (v: EncryptionKeys) => qc.setQueryData(encryptionKeysKey, v);
  return {
    save: useMutation({
      mutationFn: (body: { provider: EncryptionKeys["provider"]; key_ref: string }) =>
        unwrap(api.PUT("/v1/agencies/current/encryption-keys", { body })),
      meta: { silent: true },
      onSuccess: set,
    }),
    rotate: useMutation({
      mutationFn: () => unwrap(api.POST("/v1/agencies/current/encryption-keys/rotate")),
      meta: { silent: true },
      onSuccess: set,
    }),
    check: useMutation({
      mutationFn: () => unwrap(api.POST("/v1/agencies/current/encryption-keys/check")),
      onSuccess: set,
    }),
    leadPII: useMutation({
      mutationFn: (enabled: boolean) =>
        unwrap(api.PUT("/v1/agencies/current/encryption-keys/lead-pii", { body: { enabled } })),
      meta: { silent: true },
      onSuccess: set,
    }),
  };
}

export type AuditStream = Schemas["AuditStream"];
export type AuditStreamOverview = Schemas["AuditStreamOverview"];
export type AuditStreamInput = {
  kind: AuditStream["kind"];
  format?: AuditStream["format"];
  name: string;
  url?: string;
  header_name?: string;
  header_value?: string;
  bucket?: string;
  region?: string;
  prefix?: string;
  container_url?: string;
  access_key?: string;
  storage_secret?: string;
  backfill?: boolean;
  actions?: string[];
};
export const auditStreamsKey = ["audit-streams"] as const;

export function useAuditStreams() {
  return useQuery({
    queryKey: auditStreamsKey,
    queryFn: () => unwrap(api.GET("/v1/audit-streams")),
    refetchInterval: 15_000,
  });
}

export function useAuditStreamActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: auditStreamsKey });
  const path = (id: string) => ({ params: { path: { id } } });
  return {
    create: useMutation({
      mutationFn: (body: AuditStreamInput) => unwrap(api.POST("/v1/audit-streams", { body })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: AuditStream["status"] }) =>
        unwrap(api.PATCH("/v1/audit-streams/{id}", { ...path(id), body: { status } })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    replaceKey: useMutation({
      mutationFn: ({ id, ...body }: { id: string; access_key?: string; storage_secret: string }) =>
        unwrap(api.PATCH("/v1/audit-streams/{id}", { ...path(id), body })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/audit-streams/{id}", path(id))),
      onSuccess: refresh,
    }),
    rotate: useMutation({
      mutationFn: (id: string) => unwrap(api.POST("/v1/audit-streams/{id}/rotate-secret", path(id))),
      onSuccess: refresh,
    }),
    test: useMutation({
      mutationFn: (id: string) => unwrap(api.POST("/v1/audit-streams/{id}/test", path(id))),
    }),
  };
}

export type WarehouseExport = Schemas["WarehouseExport"];
export type WarehouseExportRun = Schemas["WarehouseExportRun"];
export type WarehouseExportInput = {
  name: string;
  kind?: WarehouseExport["kind"];
  bucket?: string;
  region?: string;
  prefix?: string;
  container_url?: string;
  access_key?: string;
  storage_secret?: string;
  hour_utc: number;
  include_contact: boolean;
};
export const warehouseExportsKey = ["warehouse-exports"] as const;

export function useWarehouseExports() {
  return useQuery({
    queryKey: warehouseExportsKey,
    queryFn: () => unwrap(api.GET("/v1/warehouse-exports")),
    refetchInterval: (q) =>
      q.state.data?.data.some((e) => e.running || e.last_run?.status === "running") ? 5_000 : false,
  });
}

export function useWarehouseExportActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: warehouseExportsKey });
  const path = (id: string) => ({ params: { path: { id } } });
  return {
    create: useMutation({
      mutationFn: (body: WarehouseExportInput) => unwrap(api.POST("/v1/warehouse-exports", { body })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: string;
        name?: string;
        hour_utc?: number;
        include_contact?: boolean;
        status?: WarehouseExport["status"];
        access_key?: string;
        storage_secret?: string;
      }) => unwrap(api.PATCH("/v1/warehouse-exports/{id}", { ...path(id), body })),
      meta: { silent: true },
      onSuccess: refresh,
    }),
    run: useMutation({
      mutationFn: (id: string) => unwrap(api.POST("/v1/warehouse-exports/{id}/run", path(id))),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/warehouse-exports/{id}", path(id))),
      onSuccess: refresh,
    }),
  };
}
