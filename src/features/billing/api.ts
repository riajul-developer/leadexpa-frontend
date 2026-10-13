"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";

/** Global billing (G2): plan summary, prices in the agency's market, Stripe checkout/portal, invoices and usage. */
export const billingKeys = {
  summary: ["billing"] as const,
  prices: ["billing", "prices"] as const,
  invoices: ["billing", "invoices"] as const,
  usage: ["billing", "usage"] as const,
};

export type Pricing = Schemas["Pricing"];
export type Subscription = Schemas["Subscription"];
export type Invoice = Schemas["Invoice"];
export type UsageReport = Schemas["UsageReport"];
export type Meter = UsageReport["meters"][number]["meter"];
export type Interval = "month" | "year";
export type PaidPlan = "starter" | "growth" | "pro";

export function useBillingSummary() {
  return useQuery({ queryKey: billingKeys.summary, queryFn: () => unwrap(api.GET("/v1/billing")) });
}

export function usePrices() {
  return useQuery({ queryKey: billingKeys.prices, queryFn: () => unwrap(api.GET("/v1/billing/prices")) });
}

export function useInvoices(enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.invoices,
    queryFn: () => unwrap(api.GET("/v1/billing/invoices")),
    enabled,
  });
}

export function useUsage() {
  return useQuery({ queryKey: billingKeys.usage, queryFn: () => unwrap(api.GET("/v1/billing/usage")) });
}

/** Starts Stripe Checkout and leaves the app for it. */
export function useCheckout() {
  return useMutation({
    mutationFn: (body: { plan: PaidPlan; interval: Interval }) => unwrap(api.POST("/v1/billing/checkout", { body })),
    onSuccess: ({ url }, body) => {
      track("billing.checkout_started", body);
      window.location.assign(url);
    },
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan: PaidPlan; interval: Interval }) => unwrap(api.POST("/v1/billing/change-plan", { body })),
    onSuccess: (_, body) => {
      track("billing.plan_changed", body);
      void qc.invalidateQueries({ queryKey: billingKeys.summary });
      void qc.invalidateQueries({ queryKey: billingKeys.invoices });
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/billing/portal")),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useSetBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ meter, limit }: { meter: Meter; limit: number | null }) =>
      unwrap(api.PUT("/v1/billing/budgets/{meter}", { params: { path: { meter } }, body: { monthly_limit: limit } })),
    onSuccess: (report) => qc.setQueryData(billingKeys.usage, report),
  });
}
