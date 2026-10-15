"use client";

import { useQuery } from "@tanstack/react-query";

import { API_URL, api, unwrap, type Schemas } from "@/shared/lib/api/client";

// Service status and SLAs (G7j). The public page reads the control plane, which measures every region from
// outside and stays up when a region doesn't; the app reads its own region through the API.

/** The control plane's public status API (NEXT_PUBLIC_STATUS_API_URL); in mock mode, the mocked API. */
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
  /** Opened by the prober from sustained down minutes, not by an operator (ADR 0052). */
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
}

export function localized(text: Localized | Record<string, string>, locale: string): string {
  return text[locale] ?? text.en ?? "";
}

export async function fetchPublicStatus(signal?: AbortSignal): Promise<PublicStatus> {
  const res = await fetch(`${STATUS_API_URL}/v1/status`, { signal, cache: "no-store", credentials: "omit" });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as PublicStatus;
}

export type ServiceStatus = Schemas["ServiceStatus"];
export type AgencySLA = Schemas["AgencySLA"];

/** This region's status for the app (incident banner, settings). */
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
