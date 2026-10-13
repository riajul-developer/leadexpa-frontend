"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

/** The app marketplace (G5 step 5e): built-in integrations and partner apps, installs and reviews. */
export const marketplaceKeys = {
  all: ["marketplace"] as const,
  list: (category?: string, q?: string) => ["marketplace", "list", category ?? null, q ?? null] as const,
  detail: (key: string) => ["marketplace", "detail", key] as const,
  installations: ["marketplace", "installations"] as const,
};

export type Listing = Schemas["MarketplaceListing"];
export type ListingDetail = Schemas["MarketplaceListingDetail"];
export type Category = Schemas["MarketplaceCategory"];
export type Review = Schemas["MarketplaceReview"];
export type Installation = Schemas["AppInstallation"];

export function useListings(category?: Category, q?: string) {
  return useQuery({
    queryKey: marketplaceKeys.list(category, q),
    queryFn: () => unwrap(api.GET("/v1/marketplace/listings", { params: { query: { category, q: q || undefined } } })),
    placeholderData: (prev) => prev,
  });
}

export function useListing(key: string) {
  return useQuery({
    queryKey: marketplaceKeys.detail(key),
    queryFn: () => unwrap(api.GET("/v1/marketplace/listings/{key}", { params: { path: { key } } })),
  });
}

export function useInstall(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scopes: Listing["scopes"]) =>
      unwrap(api.POST("/v1/marketplace/listings/{key}/install", { params: { path: { key } }, body: { scopes } })),
    meta: { silent: true },
    onSuccess: () => {
      track("app.installed", { app: key });
      void qc.invalidateQueries({ queryKey: marketplaceKeys.all });
    },
  });
}

export function useUninstall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrapEmpty(api.DELETE("/v1/marketplace/installations/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      track("app.uninstalled");
      void qc.invalidateQueries({ queryKey: marketplaceKeys.all });
    },
  });
}

export function useSaveReview(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rating: number; body: string }) =>
      unwrap(api.PUT("/v1/marketplace/listings/{key}/review", { params: { path: { key } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketplaceKeys.all }),
  });
}

export function useDeleteReview(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/marketplace/listings/{key}/review", { params: { path: { key } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketplaceKeys.all }),
  });
}
