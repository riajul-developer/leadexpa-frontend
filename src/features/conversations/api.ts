"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { channelKeys, conversationKeys, leadKeys } from "@/shared/lib/query-keys";

export type Conversation = Schemas["InboxConversation"];
export type Message = Schemas["Message"];
export type ChannelAccount = Schemas["ChannelAccount"];
export type MessageTemplate = Schemas["MessageTemplate"];
export type Channel = Conversation["channel"];

export interface InboxFilter {
  client?: string;
  channel?: Channel;
  unread?: boolean;
}

export function useInbox(f: InboxFilter) {
  return useInfiniteQuery({
    queryKey: conversationKeys.list(f),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/conversations", {
          params: {
            query: {
              cursor: pageParam,
              client_id: f.client,
              channel: f.channel,
              unread: f.unread ? "true" : undefined,
            },
          },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => unwrap(api.GET("/v1/conversations/{conversationId}", { params: { path: { conversationId: id } } })),
  });
}

export function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: conversationKeys.messages(id),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/conversations/{conversationId}/messages", {
          params: { path: { conversationId: id }, query: { cursor: pageParam } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useSendReply(conversationId: string, leadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { text?: string; template?: { name: string; language: string } }) =>
      unwrap(api.POST("/v1/conversations/{conversationId}/messages", { params: { path: { conversationId } }, body })),
    meta: { silent: true },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      void qc.invalidateQueries({ queryKey: conversationKeys.all });
      // The reply is the SLA response: the lead's chip flips to "Met".
      if (leadId) {
        void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId) });
        void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
      }
    },
  });
}

export function useClaim(conversationId: string) {
  const qc = useQueryClient();
  const claim = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/v1/conversations/{conversationId}/claim", { params: { path: { conversationId } } })),
    meta: { silent: true },
    onSuccess: (c) => qc.setQueryData(conversationKeys.detail(conversationId), c),
  });
  const release = useMutation({
    mutationFn: () =>
      unwrapEmpty(api.DELETE("/v1/conversations/{conversationId}/claim", { params: { path: { conversationId } } })),
    meta: { silent: true },
  });
  return { claim, release };
}

export function useMarkRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrapEmpty(api.POST("/v1/conversations/{conversationId}/read", { params: { path: { conversationId } } })),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: conversationKeys.all }),
  });
}

export function useChannels(clientId: string | undefined) {
  return useQuery({
    queryKey: channelKeys.client(clientId ?? ""),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/channels", { params: { path: { clientId: clientId! } } })),
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  });
}

export function useTemplates(accountId: string | undefined) {
  return useQuery({
    queryKey: channelKeys.templates(accountId ?? ""),
    queryFn: () =>
      unwrap(api.GET("/v1/channels/{accountId}/templates", { params: { path: { accountId: accountId! } } })),
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  });
}
