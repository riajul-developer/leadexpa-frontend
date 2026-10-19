"use client";

import { useSearchParams } from "next/navigation";

export function useActiveClient(): string | undefined {
  return useSearchParams().get("client") ?? undefined;
}

export function withClient(href: string, clientId: string | undefined): string {
  if (!clientId) return href;
  return href + (href.includes("?") ? "&" : "?") + "client=" + encodeURIComponent(clientId);
}
