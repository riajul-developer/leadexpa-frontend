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
      setApiBase(me.api_base_url);
      return me;
    },
    staleTime: 5 * 60_000,
  };
}

export function useMe() {
  return useQuery(meQuery());
}

/** UI only: the API enforces every permission. */
export function useCan(permission: string): boolean {
  const { data } = useMe();
  return !!data?.permissions.includes(permission);
}

export function useFlag(key: string): boolean {
  const { data } = useMe();
  return data?.flags[key] === true;
}

export function invalidateSession(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: meKey });
}
