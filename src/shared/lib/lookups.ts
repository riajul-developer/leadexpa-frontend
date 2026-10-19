"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api, unwrap, type Schemas } from "./api/client";
import { useCan } from "./session";

export type Client = Schemas["Client"];
export type Member = Schemas["Member"];

export const lookupKeys = {
  clients: ["clients", "list"] as const,
  members: ["members", "list"] as const,
  sources: (clientId: string) => ["clients", clientId, "sources"] as const,
};

export function useClients() {
  const q = useQuery({
    queryKey: lookupKeys.clients,
    queryFn: () => unwrap(api.GET("/v1/clients")),
    staleTime: 5 * 60_000,
  });
  const data = q.data?.data;
  const byId = useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data]);
  return { ...q, clients: data ?? [], byId };
}

export function useMembers() {
  const canRead = useCan("member.read");
  const q = useQuery({
    queryKey: lookupKeys.members,
    queryFn: () => unwrap(api.GET("/v1/members")),
    staleTime: 5 * 60_000,
    enabled: canRead,
  });
  const data = q.data?.data;
  const byUserId = useMemo(() => new Map((data ?? []).map((m) => [m.user.id, m])), [data]);
  return { ...q, members: data ?? [], byUserId };
}

export function useSources(clientId: string | undefined) {
  return useQuery({
    queryKey: lookupKeys.sources(clientId ?? ""),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/sources", { params: { path: { clientId: clientId! } } })),
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  });
}
