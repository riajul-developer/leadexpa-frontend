"use client";

// Kept apart from hooks.ts so read-only pages don't ship the mutations and offline queue.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { leadKeys } from "@/shared/lib/query-keys";

export type Lead = Schemas["Lead"];
export type LeadDetail = Schemas["LeadDetail"];
export type Activity = Schemas["Activity"];
export type Stage = Schemas["Stage"];
export type InboxPage = Schemas["InboxPage"];

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: leadKeys.detail(id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}", { params: { path: { leadId: id! } } })),
    enabled: !!id,
  });
}

export function useActivities(id: string) {
  return useInfiniteQuery({
    queryKey: leadKeys.activities(id),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/leads/{leadId}/activities", {
          params: { path: { leadId: id }, query: { cursor: pageParam, limit: 30 } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useSales(id: string) {
  return useQuery({
    queryKey: leadKeys.sales(id),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/sales", { params: { path: { leadId: id } } })),
  });
}

export function useNextAction(id: string, enabled = true) {
  return useQuery({
    queryKey: leadKeys.nextAction(id),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/assistant/next-action", { params: { path: { leadId: id } } })),
    enabled,
    staleTime: 60_000,
    meta: { silent: true },
  });
}

export function useConversations(id: string, enabled: boolean) {
  return useQuery({
    queryKey: leadKeys.conversations(id),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/conversations", { params: { path: { leadId: id } } })),
    enabled,
    staleTime: 30_000,
    meta: { silent: true },
  });
}
