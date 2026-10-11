"use client";

import { useSearchParams } from "next/navigation";

/** The global client filter (`?client=`): "All clients" when absent. Kept in the URL so links are shareable. */
export function useActiveClient(): string | undefined {
  return useSearchParams().get("client") ?? undefined;
}

/** Appends the active client filter to an in-app href. */
export function withClient(href: string, clientId: string | undefined): string {
  if (!clientId) return href;
  return href + (href.includes("?") ? "&" : "?") + "client=" + encodeURIComponent(clientId);
}
