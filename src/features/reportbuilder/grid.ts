// Report builder layout rules without React: the same limits the API enforces (reportbuilder/domain), so the
// editor never produces a layout the server refuses. Widgets never overlap: whatever a move or resize lands on is
// pushed down, then everything floats up into free space (a vertical compaction, like a dashboard grid).
import type { AskQuery } from "@/shared/lib/report-query";

import type { ReportWidget } from "./api";

export const COLUMNS = 12;
export const MAX_HEIGHT = 12;
export const MAX_ROWS = 200;
export const MAX_WIDGETS = 24;

export const WIDGET_TYPES = ["kpi", "line", "bar", "table", "leads", "text"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type Layout = ReportWidget["layout"];
type Metric = AskQuery["metrics"][number];

/** How many metrics each type takes and which breakdowns fit it. */
export const RULES: Record<Exclude<WidgetType, "text">, { min: number; max: number; by: AskQuery["by"][] }> = {
  kpi: { min: 1, max: 1, by: ["none"] },
  line: { min: 1, max: 3, by: ["day"] },
  bar: { min: 1, max: 2, by: ["client", "campaign", "owner"] },
  table: { min: 1, max: 6, by: ["none", "day", "client", "campaign", "owner"] },
  leads: { min: 0, max: 0, by: [""] },
};

const SIZES: Record<WidgetType, { w: number; h: number }> = {
  kpi: { w: 3, h: 2 },
  line: { w: 6, h: 4 },
  bar: { w: 6, h: 6 },
  table: { w: 6, h: 4 },
  leads: { w: 6, h: 4 },
  text: { w: 12, h: 2 },
};

export function blankQuery(kind: AskQuery["kind"]): AskQuery {
  return {
    kind,
    metrics: kind === "metrics" ? ["leads"] : [],
    by: kind === "metrics" ? "none" : "",
    period: { preset: "", from: "", to: "" },
    filters: { client_id: "", campaign_id: "", source_id: "", owner: "", stages: [], overdue: false, quality: "" },
    sort: "",
    limit: 0,
  };
}

/** A widget's query reshaped to fit a (new) type: metrics trimmed or filled, breakdown moved to one that fits. */
export function fitQuery(type: WidgetType, q: AskQuery | null | undefined): AskQuery | null {
  if (type === "text") return null;
  if (type === "leads") {
    const base = q?.kind === "leads" ? q : blankQuery("leads");
    return { ...base, kind: "leads", metrics: [], by: "", sort: "", limit: 0 };
  }
  const rule = RULES[type];
  const base = q?.kind === "metrics" ? q : blankQuery("metrics");
  let metrics = base.metrics.slice(0, rule.max);
  if (metrics.length < rule.min) metrics = ["leads"];
  const by = rule.by.includes(base.by) ? base.by : rule.by[0]!;
  const sort = base.sort && metrics.includes(base.sort as Metric) && by !== "none" && by !== "day" ? base.sort : "";
  return { ...base, kind: "metrics", metrics, by, sort, limit: sort ? base.limit : 0 };
}

export function overlaps(a: Layout, b: Layout) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function clamp(l: Layout): Layout {
  const w = Math.min(Math.max(1, Math.round(l.w)), COLUMNS);
  const h = Math.min(Math.max(1, Math.round(l.h)), MAX_HEIGHT);
  const x = Math.min(Math.max(0, Math.round(l.x)), COLUMNS - w);
  const y = Math.min(Math.max(0, Math.round(l.y)), MAX_ROWS - h);
  return { x, y, w, h };
}

const byPosition = (a: ReportWidget, b: ReportWidget) => a.layout.y - b.layout.y || a.layout.x - b.layout.x;

/**
 * Places `id` at `layout` and settles the rest: widgets it lands on move below it, then every widget except the
 * placed one floats up as far as it can. The placed widget keeps its spot so a drag feels exact.
 */
export function place(widgets: ReportWidget[], id: string, layout: Layout): ReportWidget[] {
  const moved = clamp(layout);
  const placed: ReportWidget[] = [];
  const target = widgets.find((w) => w.id === id);
  if (target) placed.push({ ...target, layout: moved });
  for (const w of [...widgets].filter((w) => w.id !== id).sort(byPosition)) {
    let l = { ...w.layout };
    // Float up first, then step down past anything in the way.
    while (l.y > 0 && !placed.some((p) => overlaps({ ...l, y: l.y - 1 }, p.layout))) l = { ...l, y: l.y - 1 };
    while (placed.some((p) => overlaps(l, p.layout))) l = { ...l, y: l.y + 1 };
    placed.push({ ...w, layout: l });
  }
  const order = new Map(widgets.map((w, i) => [w.id, i]));
  return placed.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** Every widget floated up as far as it goes (after a delete). */
export function compact(widgets: ReportWidget[]): ReportWidget[] {
  const placed: ReportWidget[] = [];
  for (const w of [...widgets].sort(byPosition)) {
    let l = { ...w.layout };
    while (l.y > 0 && !placed.some((p) => overlaps({ ...l, y: l.y - 1 }, p.layout))) l = { ...l, y: l.y - 1 };
    placed.push({ ...w, layout: l });
  }
  const order = new Map(widgets.map((w, i) => [w.id, i]));
  return placed.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** The first free spot for a new widget of this size: the first row where it fits, scanning left to right. */
export function freeSpot(widgets: ReportWidget[], w: number, h: number): Layout {
  for (let y = 0; y <= MAX_ROWS - h; y++)
    for (let x = 0; x + w <= COLUMNS; x++) {
      const l = { x, y, w, h };
      if (!widgets.some((o) => overlaps(l, o.layout))) return l;
    }
  return { x: 0, y: rows(widgets), w, h };
}

/** How many rows the layout uses. */
export function rows(widgets: ReportWidget[]) {
  return widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0);
}

let seq = 0;
export function newWidget(type: WidgetType, widgets: ReportWidget[], text = ""): ReportWidget {
  const size = SIZES[type];
  seq += 1;
  return {
    id: `w${Date.now().toString(36)}${seq}`,
    type,
    title: "",
    text,
    query: fitQuery(type, type === "line" ? { ...blankQuery("metrics"), by: "day" } : null),
    layout: freeSpot(widgets, size.w, size.h),
  };
}

/** Reading order for one column (phones, screen readers): top to bottom, then start to end. */
export function stacked(widgets: ReportWidget[]): ReportWidget[] {
  return [...widgets].sort(byPosition);
}

/** What's wrong with a widget before saving (the server checks the same), or null. */
export function problem(w: ReportWidget): "text" | "metrics" | null {
  if (w.type === "text") return w.text.trim() ? null : "text";
  if (!w.query) return "metrics";
  if (w.type === "leads") return null;
  const rule = RULES[w.type as Exclude<WidgetType, "text">];
  const n = w.query.metrics.length;
  return n < rule.min || n > rule.max || !rule.by.includes(w.query.by) ? "metrics" : null;
}

/** Starter layouts for the template gallery. Titles come from the catalog at creation time. */
export const STARTERS = {
  monthly: [
    { type: "kpi", metrics: ["leads"], layout: { x: 0, y: 0, w: 3, h: 2 } },
    { type: "kpi", metrics: ["won"], layout: { x: 3, y: 0, w: 3, h: 2 } },
    { type: "kpi", metrics: ["contact_rate"], layout: { x: 6, y: 0, w: 3, h: 2 } },
    { type: "kpi", metrics: ["revenue"], layout: { x: 9, y: 0, w: 3, h: 2 } },
    { type: "line", metrics: ["leads", "won"], by: "day", layout: { x: 0, y: 2, w: 8, h: 4 } },
    { type: "kpi", metrics: ["sla_compliance"], layout: { x: 8, y: 2, w: 4, h: 2 } },
    { type: "kpi", metrics: ["spend"], layout: { x: 8, y: 4, w: 4, h: 2 } },
    { type: "bar", metrics: ["leads"], by: "campaign", layout: { x: 0, y: 6, w: 12, h: 12 } },
  ],
  team: [
    { type: "kpi", metrics: ["sla_compliance"], layout: { x: 0, y: 0, w: 4, h: 2 } },
    { type: "kpi", metrics: ["sla_breached"], layout: { x: 4, y: 0, w: 4, h: 2 } },
    { type: "kpi", metrics: ["contact_rate"], layout: { x: 8, y: 0, w: 4, h: 2 } },
    { type: "bar", metrics: ["contact_rate"], by: "owner", layout: { x: 0, y: 2, w: 6, h: 4 } },
    {
      type: "table",
      metrics: ["leads", "won", "win_rate", "sla_breached"],
      by: "owner",
      layout: { x: 6, y: 2, w: 6, h: 4 },
    },
    { type: "leads", overdue: true, layout: { x: 0, y: 6, w: 12, h: 4 } },
  ],
  campaigns: [
    { type: "kpi", metrics: ["spend"], layout: { x: 0, y: 0, w: 4, h: 2 } },
    { type: "kpi", metrics: ["leads"], layout: { x: 4, y: 0, w: 4, h: 2 } },
    { type: "kpi", metrics: ["junk_rate"], layout: { x: 8, y: 0, w: 4, h: 2 } },
    { type: "bar", metrics: ["leads", "won"], by: "campaign", layout: { x: 0, y: 2, w: 12, h: 12 } },
    {
      type: "table",
      metrics: ["leads", "junk_rate", "won", "revenue", "spend"],
      by: "campaign",
      layout: { x: 0, y: 14, w: 12, h: 4 },
    },
  ],
} satisfies Record<
  string,
  { type: WidgetType; metrics?: Metric[]; by?: AskQuery["by"]; overdue?: boolean; layout: Layout }[]
>;
export type Starter = keyof typeof STARTERS;

export function fromStarter(key: Starter): ReportWidget[] {
  return STARTERS[key].map((s, i) => {
    const q = s.type === "leads" ? blankQuery("leads") : blankQuery("metrics");
    if ("metrics" in s && s.metrics) q.metrics = s.metrics;
    if ("by" in s && s.by) q.by = s.by;
    if ("overdue" in s && s.overdue) q.filters = { ...q.filters, overdue: true };
    return { id: `${key}${i + 1}`, type: s.type, title: "", text: "", query: fitQuery(s.type, q), layout: s.layout };
  });
}
