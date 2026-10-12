"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

// Query keys local to this feature (kept out of the shared first-load bundle).
/** Automation rules, their run log and version history. */
const automationKeys = {
  all: ["automation"] as const,
  list: (client?: string) => ["automation", "list", client ?? null] as const,
  detail: (id: string) => ["automation", "detail", id] as const,
  runs: (id: string, status?: string) => ["automation", "runs", id, status ?? null] as const,
  versions: (id: string) => ["automation", "versions", id] as const,
  leadSearch: (q: string) => ["automation", "lead-search", q] as const,
};

export type Rule = Schemas["AutomationRule"];
export type RuleInput = Schemas["AutomationRuleInput"];
export type Condition = Schemas["AutomationCondition"];
export type Action = Schemas["AutomationAction"];
export type ActionType = Action["type"];
export type Run = Schemas["AutomationRun"];
export type Check = Schemas["AutomationCheck"];
export type RuleVersion = Schemas["AutomationRuleVersion"];
export type EventType = RuleInput["event"];
export type Op = Condition["op"];

export function useRules(client?: string) {
  return useQuery({
    queryKey: automationKeys.list(client),
    queryFn: () => unwrap(api.GET("/v1/automation/rules", { params: { query: { client_id: client } } })),
  });
}

export function useRule(id: string | null) {
  return useQuery({
    queryKey: automationKeys.detail(id ?? ""),
    queryFn: () => unwrap(api.GET("/v1/automation/rules/{ruleId}", { params: { path: { ruleId: id! } } })),
    enabled: !!id,
  });
}

export function useSaveRule(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RuleInput) =>
      id
        ? unwrap(api.PUT("/v1/automation/rules/{ruleId}", { params: { path: { ruleId: id } }, body }))
        : unwrap(api.POST("/v1/automation/rules", { body })),
    meta: { silent: true },
    onSuccess: (r) => {
      track(id ? "automation.rule_updated" : "automation.rule_created", { event: r.event, actions: r.actions.length });
      qc.setQueryData(automationKeys.detail(r.id), r);
      void qc.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function useSetEnabled(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      unwrap(
        api.POST("/v1/automation/rules/{ruleId}/enabled", { params: { path: { ruleId: id } }, body: { enabled } }),
      ),
    meta: { silent: true },
    onSuccess: (r) => {
      track("automation.rule_toggled", { enabled: r.enabled });
      qc.setQueryData(automationKeys.detail(r.id), r);
      void qc.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function useDeleteRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/automation/rules/{ruleId}", { params: { path: { ruleId: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useRuns(id: string, status?: Run["status"]) {
  return useInfiniteQuery({
    queryKey: automationKeys.runs(id, status),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/automation/rules/{ruleId}/runs", {
          params: { path: { ruleId: id }, query: { cursor: pageParam, status } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: 15_000,
  });
}

export function useVersions(id: string) {
  return useQuery({
    queryKey: automationKeys.versions(id),
    queryFn: () => unwrap(api.GET("/v1/automation/rules/{ruleId}/versions", { params: { path: { ruleId: id } } })),
  });
}

export function useTestRule() {
  return useMutation({
    mutationFn: (body: { rule: RuleInput; lead_id: string }) => unwrap(api.POST("/v1/automation/rules/test", { body })),
    meta: { silent: true },
  });
}

export function useSimulate() {
  return useMutation({
    mutationFn: (rule: RuleInput) => unwrap(api.POST("/v1/automation/rules/simulate", { body: { rule } })),
    meta: { silent: true },
  });
}

/** Lead search for "test on a lead". */
export function useLeadSearch(q: string) {
  return useQuery({
    queryKey: automationKeys.leadSearch(q),
    queryFn: () => unwrap(api.GET("/v1/leads", { params: { query: { q, limit: 6, quality: "all" } } })),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });
}
