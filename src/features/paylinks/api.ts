"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { leadKeys } from "@/shared/lib/query-keys";

/** Payment links (17.0.2): merchant accounts per client, links per lead, and the payer's public page. */
export const payKeys = {
  all: ["paylinks"] as const,
  accounts: (clientId: string) => ["paylinks", "accounts", clientId] as const,
  forLead: (leadId: string) => ["paylinks", "lead", leadId] as const,
  forClient: (clientId: string, status?: string) => ["paylinks", "client", clientId, status ?? null] as const,
  public: (token: string) => ["paylinks", "public", token] as const,
};

export type PaymentAccount = Schemas["PaymentAccount"];
export type PaymentLink = Schemas["PaymentLink"];
export type PaymentStatus = Schemas["PaymentLinkStatus"];
export type PublicView = Schemas["PaymentPublicView"];
export type Purpose = PaymentLink["purpose"];
export const PURPOSES: Purpose[] = ["booking_fee", "advance", "full", "other"];

export function usePaymentAccounts(clientId: string) {
  return useQuery({
    queryKey: payKeys.accounts(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/payment-accounts", { params: { path: { clientId } } })),
  });
}

export function useConnectAccount(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      provider: "bkash" | "sslcommerz";
      mode: "sandbox" | "live";
      credentials: Record<string, string>;
    }) => unwrap(api.POST("/v1/clients/{clientId}/payment-accounts", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (a) => {
      track("payments.account_connected", { provider: a.provider, mode: a.mode });
      void qc.invalidateQueries({ queryKey: payKeys.accounts(clientId) });
    },
  });
}

export function useUpdateAccount(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: "active" | "disabled"; auto_won?: boolean }) =>
      unwrap(api.PATCH("/v1/payment-accounts/{id}", { params: { path: { id } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: payKeys.accounts(clientId) }),
  });
}

export function useRemoveAccount(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/payment-accounts/{id}", { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: payKeys.accounts(clientId) }),
  });
}

export function useLeadPaymentLinks(leadId: string) {
  return useQuery({
    queryKey: payKeys.forLead(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/payment-links", { params: { path: { leadId } } })),
  });
}

export function useClientPaymentLinks(clientId: string, status?: PaymentStatus) {
  return useQuery({
    queryKey: payKeys.forClient(clientId, status),
    queryFn: () =>
      unwrap(
        api.GET("/v1/clients/{clientId}/payment-links", {
          params: { path: { clientId }, query: status ? { status } : {} },
        }),
      ),
  });
}

export function useCreatePaymentLink(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      ...body
    }: {
      key: string;
      amount_minor: number;
      purpose: Purpose;
      note?: string;
      expires_in_hours?: number;
    }) =>
      unwrap(
        api.POST("/v1/leads/{leadId}/payment-links", {
          params: { path: { leadId }, header: { "Idempotency-Key": key } },
          body,
        }),
      ),
    meta: { silent: true },
    onSuccess: (r) => {
      track("payments.link_created", { provider: r.link.provider, purpose: r.link.purpose });
      void qc.invalidateQueries({ queryKey: payKeys.forLead(leadId) });
      void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
    },
  });
}

export function useCancelPaymentLink(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/v1/payment-links/{id}/cancel", { params: { path: { id } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payKeys.all });
      void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
    },
  });
}

export function useMarkRefunded(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/v1/payment-links/{id}/refunded", { params: { path: { id } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payKeys.all });
      void qc.invalidateQueries({ queryKey: leadKeys.sales(leadId) });
      void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
    },
  });
}
