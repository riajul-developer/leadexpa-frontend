"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, API_URL, CSRF_COOKIE, readCookie, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { toApiError } from "@/shared/lib/api/errors";

/** Lead Leakage Audits and AI business reviews (10.3). */
export const auditKeys = {
  list: ["audits"] as const,
  one: (id: string) => ["audits", id] as const,
  reviews: (clientId: string) => ["business-reviews", clientId] as const,
};

export type LeakageAudit = Schemas["LeakageAudit"];
export type AuditReport = Schemas["AuditReport"];
export type AuditImport = Schemas["AuditImport"];
export type BusinessReview = Schemas["BusinessReview"];
export type ReviewContent = Schemas["ReviewContent"];
export type ReviewFact = Schemas["ReviewFact"];

export function useAudits() {
  return useQuery({ queryKey: auditKeys.list, queryFn: () => unwrap(api.GET("/v1/audits")) });
}

export function useAudit(id: string) {
  return useQuery({
    queryKey: auditKeys.one(id),
    queryFn: () => unwrap(api.GET("/v1/audits/{auditId}", { params: { path: { auditId: id } } })),
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      prospect_name: string;
      industry?: string;
      country: string;
      consent_name: string;
      consent_email: string;
      consent_text: string;
    }) => unwrap(api.POST("/v1/audits", { body })),
    meta: { silent: true },
    onSuccess: () => {
      track("audit.created");
      void qc.invalidateQueries({ queryKey: auditKeys.list });
    },
  });
}

export function useUploadAuditLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // Multipart: openapi-fetch serializes JSON, so post the file directly (CSRF + idempotency by hand).
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/v1/audits/${id}/leads/csv`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": readCookie(CSRF_COOKIE) ?? "", "Idempotency-Key": crypto.randomUUID() },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw toApiError(res, json);
      return json as AuditImport;
    },
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: auditKeys.one(id) }),
  });
}

export function useSetAssumptions(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      deal_value_low: number | null;
      deal_value_high: number | null;
      close_rate_low: number | null;
      close_rate_high: number | null;
      business_hours: { from: string; to: string };
    }) => unwrap(api.PUT("/v1/audits/{auditId}/assumptions", { params: { path: { auditId: id } }, body })),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: auditKeys.one(id) }),
  });
}

export function useShareAudit(id: string) {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/audits/{auditId}/share", { params: { path: { auditId: id } } })),
    onSuccess: () => track("audit.shared"),
  });
}

export function useConvertAudit(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      unwrap(
        api.POST("/v1/audits/{auditId}/convert", { params: { path: { auditId: id } }, body: { client_id: clientId } }),
      ),
    onSuccess: () => {
      track("audit.converted");
      void qc.invalidateQueries({ queryKey: auditKeys.one(id) });
    },
  });
}

export function useDeleteAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapEmpty(api.DELETE("/v1/audits/{auditId}", { params: { path: { auditId: id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: auditKeys.list }),
  });
}

export function useBusinessReviews(clientId: string) {
  return useQuery({
    queryKey: auditKeys.reviews(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/business-reviews", { params: { path: { clientId } } })),
  });
}

export function useGenerateReview(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: "monthly" | "quarterly"; language?: string }) =>
      unwrap(api.POST("/v1/clients/{clientId}/business-reviews", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("business_review.generated", { kind: r.kind });
      void qc.invalidateQueries({ queryKey: auditKeys.reviews(clientId) });
    },
  });
}

export function useReviewActions(clientId: string) {
  const qc = useQueryClient();
  const done = () => void qc.invalidateQueries({ queryKey: auditKeys.reviews(clientId) });
  return {
    save: useMutation({
      mutationFn: ({ id, content }: { id: string; content: ReviewContent }) =>
        unwrap(api.PUT("/v1/business-reviews/{reviewId}", { params: { path: { reviewId: id } }, body: { content } })),
      meta: { silent: true },
      onSuccess: done,
    }),
    approve: useMutation({
      mutationFn: (id: string) =>
        unwrap(api.POST("/v1/business-reviews/{reviewId}/approve", { params: { path: { reviewId: id } } })),
      onSuccess: () => {
        track("business_review.approved");
        done();
      },
    }),
    share: useMutation({
      mutationFn: (id: string) =>
        unwrap(api.POST("/v1/business-reviews/{reviewId}/share", { params: { path: { reviewId: id } } })),
      meta: { silent: true },
      onSuccess: done,
    }),
  };
}
