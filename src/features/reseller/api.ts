"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

export const resellerKeys = {
  all: ["reseller"] as const,
  account: ["reseller", "account"] as const,
  plans: ["reseller", "plans"] as const,
  links: ["reseller", "links"] as const,
  overview: ["reseller", "overview"] as const,
  payouts: ["reseller", "payouts"] as const,
  buy: (code: string) => ["reseller", "buy", code] as const,
};

export type ConnectedAccount = Schemas["ConnectedAccount"];
export type ResellerPlan = Schemas["ResellerPlan"];
export type ResellerLink = Schemas["ResellerLink"];
export type ResellerOverview = Schemas["ResellerOverview"];
export type BuyView = Schemas["BuyView"];

export function useConnectedAccount() {
  return useQuery({ queryKey: resellerKeys.account, queryFn: () => unwrap(api.GET("/v1/reseller/account")) });
}

export function useOnboarding() {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/reseller/account/onboarding")),
    onSuccess: ({ url }) => {
      track("reseller.onboarding_started");
      window.location.assign(url);
    },
  });
}

export function useStripeDashboard() {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/reseller/account/dashboard")),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });
}

export function useResellerPlans(enabled = true) {
  return useQuery({ queryKey: resellerKeys.plans, queryFn: () => unwrap(api.GET("/v1/reseller/plans")), enabled });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      amount_minor: number;
      currency: string;
      interval?: "month" | "year";
    }) => unwrap(api.POST("/v1/reseller/plans", { body })),
    meta: { silent: true },
    onSuccess: (p) => {
      track("reseller.plan_created", { currency: p.currency, interval: p.interval ?? "once" });
      void qc.invalidateQueries({ queryKey: resellerKeys.plans });
    },
  });
}

export function useSetPlanActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      unwrap(api.PATCH("/v1/reseller/plans/{id}", { params: { path: { id } }, body: { active } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: resellerKeys.plans });
      void qc.invalidateQueries({ queryKey: resellerKeys.links });
    },
  });
}

export function useResellerLinks(enabled = true) {
  return useQuery({ queryKey: resellerKeys.links, queryFn: () => unwrap(api.GET("/v1/reseller/links")), enabled });
}

export function useCreateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan_id: string; client_id?: string | null; email?: string }) =>
      unwrap(api.POST("/v1/reseller/links", { body })),
    meta: { silent: true },
    onSuccess: () => {
      track("reseller.link_created");
      void qc.invalidateQueries({ queryKey: resellerKeys.links });
    },
  });
}

export function useSetLinkStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      unwrapEmpty(api.PATCH("/v1/reseller/links/{id}", { params: { path: { id } }, body: { status } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: resellerKeys.links }),
  });
}

export function useResellerOverview(enabled = true) {
  return useQuery({
    queryKey: resellerKeys.overview,
    queryFn: () => unwrap(api.GET("/v1/reseller/overview")),
    enabled,
  });
}

export function useResellerPayouts(enabled = true) {
  return useQuery({ queryKey: resellerKeys.payouts, queryFn: () => unwrap(api.GET("/v1/reseller/payouts")), enabled });
}

export function useBuyView(code: string) {
  return useQuery({
    queryKey: resellerKeys.buy(code),
    queryFn: () => unwrap(api.GET("/v1/public/buy/{code}", { params: { path: { code } } })),
    retry: false,
  });
}

export function useBuyCheckout(code: string) {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/public/buy/{code}/checkout", { params: { path: { code } } })),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
