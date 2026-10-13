"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { toast } from "@/shared/lib/toast";

/** The AI agent (17.12): definition, knowledge base, approvals, monitor, evals, kill switch. */
export const agentKeys = {
  all: ["agent"] as const,
  agent: (clientId: string) => ["agent", "def", clientId] as const,
  kb: (clientId: string) => ["agent", "kb", clientId] as const,
  drafts: ["agent", "drafts"] as const,
  conversations: (status?: string) => ["agent", "conversations", status ?? "all"] as const,
  transcript: (id: string) => ["agent", "transcript", id] as const,
  killSwitch: ["agent", "kill-switch"] as const,
};

export type Agent = Schemas["Agent"];
export type AgentInput = Schemas["AgentInput"];
export type Draft = Schemas["AgentDraft"];
export type AgentConversation = Schemas["AgentConversation"];
export type Transcript = Schemas["AgentTranscript"];
export type EvalRun = Schemas["AgentEvalRun"];
export type KbDocument = Schemas["KbDocument"];

export const TRIGGERS = [
  "buying_intent",
  "complaint",
  "price_negotiation",
  "human_requested",
  "low_confidence",
  "appointment",
] as const;
export const CHANNELS = ["whatsapp", "sms", "messenger", "instagram"] as const;

export function useAgent(clientId: string) {
  return useQuery({
    queryKey: agentKeys.agent(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/agent", { params: { path: { clientId } } })),
  });
}

export function useSaveAgent(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AgentInput) =>
      unwrap(api.PUT("/v1/clients/{clientId}/agent", { params: { path: { clientId } }, body })),
    onSuccess: (a) => qc.setQueryData(agentKeys.agent(clientId), a),
  });
}

export function useSetAutonomy(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (level: number) =>
      unwrap(api.PUT("/v1/clients/{clientId}/agent/autonomy", { params: { path: { clientId } }, body: { level } })),
    meta: { silent: true },
    onSuccess: (a) => {
      track("agent.autonomy", { level: a.autonomy });
      qc.setQueryData(agentKeys.agent(clientId), a);
    },
  });
}

export function useRunEval(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (language: string) =>
      unwrap(api.POST("/v1/clients/{clientId}/agent/evals", { params: { path: { clientId } }, body: { language } })),
    onSuccess: (r) => {
      track("agent.eval", { language: r.language, passed: r.passed });
      void qc.invalidateQueries({ queryKey: agentKeys.agent(clientId) });
    },
  });
}

export function useKnowledge(clientId: string) {
  return useQuery({
    queryKey: agentKeys.kb(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/kb", { params: { path: { clientId } } })),
  });
}

export function useAddKnowledge(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; text?: string; url?: string }) =>
      unwrap(api.POST("/v1/clients/{clientId}/kb", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.kb(clientId) }),
  });
}

export function useDeleteKnowledge(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      unwrapEmpty(api.DELETE("/v1/kb/{documentId}", { params: { path: { documentId } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.kb(clientId) }),
  });
}

export function useSearchKnowledge(clientId: string) {
  return useMutation({
    mutationFn: (q: string) =>
      unwrap(api.GET("/v1/clients/{clientId}/kb/search", { params: { path: { clientId }, query: { q } } })),
  });
}

export function useKillSwitch() {
  return useQuery({ queryKey: agentKeys.killSwitch, queryFn: () => unwrap(api.GET("/v1/agent/kill-switch")) });
}

export function useSetKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (killed: boolean) => unwrap(api.PUT("/v1/agent/kill-switch", { body: { killed } })),
    onSuccess: (r) => {
      track("agent.kill_switch", { killed: r.killed });
      qc.setQueryData(agentKeys.killSwitch, r);
      void qc.invalidateQueries({ queryKey: ["agent", "def"] });
    },
  });
}

export function useDrafts() {
  return useQuery({ queryKey: agentKeys.drafts, queryFn: () => unwrap(api.GET("/v1/agent/drafts")) });
}

/** Approve or discard a draft. The card leaves the queue at once, so the outcome toasts live here, not in the card. */
export function useDecideDraft(messages: { sent: string; discarded: string; failed: (e: unknown) => string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, text }: { id: string; approve: boolean; text?: string }) =>
      approve
        ? unwrap(
            api.POST("/v1/agent/drafts/{draftId}/approve", {
              params: { path: { draftId: id } },
              body: { text: text ?? "" },
            }),
          )
        : unwrap(api.POST("/v1/agent/drafts/{draftId}/reject", { params: { path: { draftId: id } } })),
    meta: { silent: true },
    onMutate: ({ id }) => {
      // Swipe feels instant: drop the card now, put it back if the request fails.
      const prev = qc.getQueryData<{ data: Draft[] }>(agentKeys.drafts);
      if (prev) qc.setQueryData(agentKeys.drafts, { data: prev.data.filter((d) => d.id !== id) });
      return { prev };
    },
    onSuccess: (_d, v) => toast.success(v.approve ? messages.sent : messages.discarded),
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(agentKeys.drafts, ctx.prev);
      toast.error(messages.failed(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: agentKeys.drafts }),
  });
}

export function useAgentConversations(status?: string) {
  return useQuery({
    queryKey: agentKeys.conversations(status),
    queryFn: () =>
      unwrap(
        api.GET("/v1/agent/conversations", {
          params: { query: status ? { status: status as "active" | "handed_off" | "ended" } : {} },
        }),
      ),
  });
}

export function useTranscript(id: string | null) {
  return useQuery({
    queryKey: agentKeys.transcript(id ?? ""),
    queryFn: () =>
      unwrap(api.GET("/v1/agent/conversations/{conversationId}", { params: { path: { conversationId: id! } } })),
    enabled: !!id,
  });
}

export function useConversationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "take-over" | "resume" }) =>
      action === "take-over"
        ? unwrapEmpty(
            api.POST("/v1/agent/conversations/{conversationId}/take-over", {
              params: { path: { conversationId: id } },
            }),
          )
        : unwrapEmpty(
            api.POST("/v1/agent/conversations/{conversationId}/resume", { params: { path: { conversationId: id } } }),
          ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useRateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quality, note }: { id: string; quality: number; note?: string }) =>
      unwrapEmpty(
        api.POST("/v1/agent/conversations/{conversationId}/rating", {
          params: { path: { conversationId: id } },
          body: { quality, note: note ?? "" },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}
