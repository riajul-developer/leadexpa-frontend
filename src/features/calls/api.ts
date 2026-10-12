"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { leadKeys } from "@/shared/lib/query-keys";

// Query keys local to this feature (kept out of the shared first-load bundle).
/** Calls (click-to-call, PBX events), calling numbers, call settings and coaching. */
const callKeys = {
  all: ["calls"] as const,
  list: (f: { client?: string; lead?: string }) => ["calls", "list", f] as const,
  detail: (id: string) => ["calls", "detail", id] as const,
  coaching: (days: number, client?: string) => ["calls", "coaching", days, client ?? null] as const,
  numbers: (clientId: string) => ["voice-numbers", clientId] as const,
  settings: ["call-settings"] as const,
  myPhone: ["my-call-phone"] as const,
};

export type Call = Schemas["Call"];
export type CallStatus = Call["status"];
export type VoiceNumber = Schemas["VoiceNumber"];
export type CallSettings = Schemas["CallSettings"];
export type AgentCoaching = Schemas["AgentCoaching"];
export type Turn = Call["transcript"][number];

/** Statuses after which nothing changes but the recording and transcript. */
export const FINAL: ReadonlySet<CallStatus> = new Set([
  "completed",
  "no_answer",
  "busy",
  "failed",
  "canceled",
  "missed",
  "agent_missed",
]);

/** A call is still being processed (ringing, or a transcript on its way): worth polling. */
function live(c: Call | undefined) {
  return !!c && (!FINAL.has(c.status) || c.recording_status === "pending" || c.transcript_status === "pending");
}

export function useCalls(f: { client?: string; lead?: string }) {
  return useInfiniteQuery({
    queryKey: callKeys.list(f),
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/v1/calls", { params: { query: { cursor: pageParam, client_id: f.client, lead_id: f.lead } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: (q) => (q.state.data?.pages.some((p) => p.data.some(live)) ? 4000 : false),
  });
}

export function useCall(id: string | null) {
  return useQuery({
    queryKey: callKeys.detail(id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/calls/{callId}", { params: { path: { callId: id! } } })),
    enabled: !!id,
    refetchInterval: (q) => (live(q.state.data) ? 2000 : false),
  });
}

/** Click-to-call: the caller's phone rings first, then the lead is dialled from the client's number. */
export function usePlaceCall(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/leads/{leadId}/calls", { params: { path: { leadId } } })),
    meta: { silent: true },
    onSuccess: (c) => {
      track("call.placed");
      qc.setQueryData(callKeys.detail(c.id), c);
      void qc.invalidateQueries({ queryKey: callKeys.all });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
      void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId) });
    },
  });
}

export function useCoaching(days: number, client?: string) {
  return useQuery({
    queryKey: callKeys.coaching(days, client),
    queryFn: () => unwrap(api.GET("/v1/calls/coaching", { params: { query: { days, client_id: client } } })),
  });
}

export function useVoiceNumbers(clientId: string | undefined) {
  return useQuery({
    queryKey: callKeys.numbers(clientId ?? ""),
    queryFn: () =>
      unwrap(api.GET("/v1/clients/{clientId}/voice-numbers", { params: { path: { clientId: clientId! } } })),
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  });
}

export function useConnectVoiceNumber(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { provider: "twilio" | "pbx"; number: string; account_id?: string; auth_token?: string }) =>
      unwrap(api.POST("/v1/clients/{clientId}/voice-numbers", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (n) => {
      track("call.number_connected", { provider: n.provider });
      void qc.invalidateQueries({ queryKey: callKeys.numbers(clientId) });
    },
  });
}

export function useDisconnectVoiceNumber(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      unwrapEmpty(api.DELETE("/v1/voice-numbers/{accountId}", { params: { path: { accountId } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: callKeys.numbers(clientId) }),
  });
}

export function useCallSettings() {
  return useQuery({ queryKey: callKeys.settings, queryFn: () => unwrap(api.GET("/v1/calls-settings")) });
}

export function useSaveCallSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallSettings) => unwrap(api.PUT("/v1/calls-settings", { body })),
    meta: { silent: true },
    onSuccess: (s) => {
      qc.setQueryData(callKeys.settings, s);
      track("call.settings_updated", { record_calls: s.record_calls });
    },
  });
}

export function useMyCallPhone() {
  return useQuery({ queryKey: callKeys.myPhone, queryFn: () => unwrap(api.GET("/v1/me/call-phone")) });
}

export function useSaveMyCallPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phone: string | null) => unwrap(api.PUT("/v1/me/call-phone", { body: { phone } })),
    meta: { silent: true },
    onSuccess: (p) => qc.setQueryData(callKeys.myPhone, p),
  });
}

/** The recording URL (same-origin API, cookie auth): the browser streams it in an <audio> element. */
export function recordingUrl(callId: string) {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  return `${base}/v1/calls/${callId}/recording`;
}
