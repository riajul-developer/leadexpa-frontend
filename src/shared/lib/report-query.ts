// The reporting query DSL ("Ask your data", 17.13), shared by /ask and the report builder (8g): the metrics,
// periods and breakdowns a query may use, and how to read a metric out of a breakdown row.
import type { Schemas } from "./api/client";

export type AskQuery = Schemas["AskQuery"];
export type Breakdown = Schemas["Breakdown"];

export const METRICS = [
  "leads",
  "won",
  "revenue",
  "spend",
  "contact_rate",
  "win_rate",
  "sla_compliance",
  "sla_breached",
  "junk",
  "junk_rate",
] as const;
export type Metric = (typeof METRICS)[number];
export const PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_quarter",
  "this_year",
] as const;
export const BREAKDOWNS = ["none", "day", "client", "campaign", "owner"] as const;
export const STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;

/** The value of one DSL metric in a breakdown row (null: not available, e.g. money across currencies). */
export function metricValue(b: Breakdown, m: string): number | null {
  switch (m) {
    case "leads":
      return b.leads_received;
    case "junk":
      return b.leads_junk ?? 0;
    case "junk_rate":
      return b.junk_rate ?? null;
    case "contact_rate":
      return b.contact_rate ?? null;
    case "won":
      return b.leads_won;
    case "win_rate":
      return b.win_rate ?? null;
    case "sla_compliance":
      return b.sla_compliance ?? null;
    case "sla_breached":
      return b.sla_breached;
    case "revenue":
      return b.revenue_minor ?? null;
    case "spend":
      return b.spend_minor ?? null;
  }
  return null;
}

export const isRate = (m: string) => m.endsWith("_rate") || m === "sla_compliance";
export const isMoney = (m: string) => m === "revenue" || m === "spend";
