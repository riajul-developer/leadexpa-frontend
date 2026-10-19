"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import type { Schemas } from "@/shared/lib/api/client";
import { type Breakdown, isMoney, isRate, metricValue } from "@/shared/lib/report-query";
import { StageBadge } from "@/shared/ui/badges";
import { Skeleton } from "@/shared/ui/primitives";

import type { ReportWidget } from "./api";

const RbChart = dynamic(() => import("./rb-chart"), { ssr: false, loading: () => <Skeleton className="size-full" /> });

export type WidgetData = {
  metrics?: Schemas["AskMetricsResult"] | null;
  count?: number | null;
  preview?: Schemas["Lead"][];
};

type T = ReturnType<typeof useTranslations>;

export function autoTitle(ta: T, t: T, w: ReportWidget): string {
  if (w.title) return w.title;
  if (w.type === "text") return "";
  const q = w.query;
  if (!q || w.type === "leads") return q?.filters.overdue ? t("auto.overdueLeads") : t("auto.leads");
  const names = q.metrics.map((m) => ta(`metric.${m}`)).join(" · ");
  return q.by && q.by !== "none" ? `${names} — ${ta(`by.${q.by}`).toLowerCase()}` : names;
}

export function WidgetView({ widget, data, loading }: { widget: ReportWidget; data?: WidgetData; loading?: boolean }) {
  const t = useTranslations("reportBuilder");
  const ta = useTranslations("ask");
  const f = useFormat();
  if (widget.type === "text")
    return <p className="text-text overflow-auto text-sm leading-relaxed whitespace-pre-wrap">{widget.text}</p>;
  if (loading && !data) return <Skeleton className="size-full min-h-12" />;

  if (widget.type === "leads") {
    const count = data?.count;
    return (
      <div className="flex min-h-0 flex-col gap-2">
        <p className="text-3xl font-semibold tabular-nums" data-testid="rb-count">
          {count == null ? "—" : f.number(count)}
        </p>
        {data?.preview && data.preview.length > 0 && (
          <ul className="grid min-h-0 gap-1 overflow-auto text-sm">
            {data.preview.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <Link href={`/leads/${l.id}`} className="text-primary truncate hover:underline">
                  {l.full_name || l.phone?.display || "—"}
                </Link>
                <StageBadge stage={l.stage} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const m = data?.metrics;
  const q = widget.query;
  if (!m || !q) return <p className="text-muted text-sm">{t("noData")}</p>;
  const fmt = (v: number | null, k: string) => {
    if (v == null) return "—";
    if (isRate(k)) return f.percent(v);
    if (isMoney(k)) return m.currency ? f.money({ amount_minor: v, currency: m.currency }) : "—";
    return f.number(v);
  };
  const rowName = (b: Breakdown) =>
    q.by === "day"
      ? b.day
        ? f.dateTime(b.day + "T12:00:00Z", "UTC", "date")
        : ""
      : b.name || (q.by === "owner" ? ta("chips.unassigned") : ta("none"));

  if (widget.type === "kpi") {
    const k = q.metrics[0]!;
    return (
      <p className="text-3xl font-semibold tabular-nums" data-testid="rb-kpi">
        {fmt(metricValue(m.total, k), k)}
      </p>
    );
  }

  if (widget.type === "table") {
    const rows = q.by === "none" || !q.by ? [m.total] : m.rows;
    return (
      <div className="min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{autoTitle(ta, t, widget)}</caption>
          <thead className="text-muted text-xs">
            <tr className="border-border border-b">
              {q.by !== "none" && (
                <th scope="col" className="p-1.5 text-start font-medium">
                  {ta(`by.${q.by}`)}
                </th>
              )}
              {q.metrics.map((k) => (
                <th key={k} scope="col" className="p-1.5 text-end font-medium">
                  {ta(`metric.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={q.metrics.length + 1} className="text-muted p-2 text-center">
                  {t("noData")}
                </td>
              </tr>
            )}
            {rows.map((b, i) => (
              <tr key={(b.id ?? b.day ?? "") + i} className="border-border border-b last:border-0">
                {q.by !== "none" && (
                  <th scope="row" className="max-w-40 truncate p-1.5 text-start font-medium">
                    {rowName(b)}
                  </th>
                )}
                {q.metrics.map((k) => (
                  <td key={k} className="p-1.5 text-end tabular-nums">
                    {fmt(metricValue(b, k), k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (m.rows.length === 0) return <p className="text-muted text-sm">{t("noData")}</p>;
  const series = q.metrics.map((k) => ({ key: k, label: ta(`metric.${k}`), format: (v: number) => fmt(v, k) }));
  const rows = m.rows.map((b) => ({
    name: rowName(b),
    ...Object.fromEntries(q.metrics.map((k) => [k, metricValue(b, k) ?? 0])),
  }));
  return (
    <div className="min-h-0 flex-1">
      <RbChart rows={rows} series={series} line={widget.type === "line"} label={autoTitle(ta, t, widget)} />
    </div>
  );
}
