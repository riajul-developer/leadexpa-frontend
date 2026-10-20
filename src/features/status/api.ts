"use client";

import { useQuery } from "@tanstack/react-query";

import { API_URL, api, unwrap, type Schemas } from "@/shared/lib/api/client";

// The public page reads the control plane, so it stays up when a region is down.

export const STATUS_API_URL = (process.env.NEXT_PUBLIC_STATUS_API_URL ?? API_URL).replace(/\/$/, "");

export type ComponentKey = "app" | "lead_capture" | "automations" | "messaging";
export type HealthState = "operational" | "degraded" | "down" | "no_data";
export type Localized = { en: string } & Record<string, string>;

export interface StatusDay {
  date: string;
  uptime: number | null;
  state: HealthState;
}
export interface StatusComponent {
  key: ComponentKey;
  state: HealthState;
  detail: string;
  uptime_90d: number;
  days: StatusDay[];
}
export interface StatusRegion {
  region: string;
  state: HealthState;
  maintenance: boolean;
  uptime_90d: number;
  components: StatusComponent[];
}
export interface StatusIncident {
  id: string;
  kind: "incident" | "maintenance";
  title: Localized;
  impact: "none" | "minor" | "major" | "critical";
  status: string;
  regions: string[];
  components: string[];
  started_at: string;
  resolved_at?: string | null;
  automatic?: boolean;
  scheduled_for: string | null;
  scheduled_until: string | null;
  updates: { status: string; body: Localized; created_at: string }[];
}
export interface PublicStatus {
  generated_at: string;
  state: HealthState;
  regions: StatusRegion[];
  active: StatusIncident[];
  upcoming: StatusIncident[];
  history: StatusIncident[];
  sla_targets: { standard: number; enterprise: number };
  subscriptions?: boolean;
}

export function localized(text: Localized | Record<string, string>, locale: string): string {
  return text[locale] ?? text.en ?? "";
}

export async function fetchPublicStatus(signal?: AbortSignal): Promise<PublicStatus> {
  const res = await fetch(`${STATUS_API_URL}/v1/status`, { signal, cache: "no-store", credentials: "omit" });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as PublicStatus;
}

export interface SubscriptionResult {
  status: number;
  code?: string;
  body?: { email?: string; locale?: string; regions?: string[] };
}

export async function postSubscription(
  path: "" | "/confirm" | "/unsubscribe",
  body: Record<string, unknown>,
): Promise<SubscriptionResult> {
  const res = await fetch(`${STATUS_API_URL}/v1/status/subscriptions${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { code?: string } & SubscriptionResult["body"];
  return { status: res.status, code: res.ok ? undefined : json.code, body: res.ok ? json : undefined };
}

export type ServiceStatus = Schemas["ServiceStatus"];
export type AgencySLA = Schemas["AgencySLA"];

export function useServiceStatus() {
  return useQuery({
    queryKey: ["service-status"],
    queryFn: () => unwrap(api.GET("/v1/service-status")),
    refetchInterval: 120_000,
    staleTime: 60_000,
    meta: { silent: true },
  });
}

export function useAgencySLA(month: string) {
  return useQuery({
    queryKey: ["agency-sla", month],
    queryFn: () => unwrap(api.GET("/v1/agencies/current/sla", { params: { query: { month } } })),
    retry: false,
    meta: { silent: true },
  });
}
