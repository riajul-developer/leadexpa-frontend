"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";

import { api, setApiBase, unwrap, type Schemas } from "./api/client";

export type Me = Schemas["Me"];
export type Role = Schemas["Role"];

export const meKey = ["me"] as const;

export function meQuery() {
  return {
    queryKey: meKey,
    queryFn: async () => {
      const me = await unwrap(api.GET("/v1/me"));
      setApiBase(me.api_base_url); // the agency's region (G1)
      return me;
    },
    staleTime: 5 * 60_000,
  };
}

/** The signed-in user, active agency, role, permissions and flags (GET /v1/me). */
export function useMe() {
  return useQuery(meQuery());
}

/**
 * Permission check for showing/hiding UI. The API enforces everything; this only avoids offering actions
 * that would fail. Permissions come from /v1/me (e.g. "lead.assign", "integration.manage").
 */
export function useCan(permission: string): boolean {
  const { data } = useMe();
  return !!data?.permissions.includes(permission);
}

/** Per-agency feature flag from /v1/me; every post-MVP feature ships behind one. */
export function useFlag(key: string): boolean {
  const { data } = useMe();
  return data?.flags[key] === true;
}

export function invalidateSession(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: meKey });
}
