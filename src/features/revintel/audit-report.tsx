"use client";

import { AlertTriangle, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives";

import type { AuditReport } from "./audit-api";

const BAR_TONE: Record<string, string> = {
  under_5m: "bg-success",
  "5m_30m": "bg-info",
  "30m_2h": "bg-warning",
  "2h_24h": "bg-warning",
  over_24h: "bg-danger",
  never: "bg-danger",
};

/** The Leakage Audit report: speed, missed leads, the estimate with its assumptions, and the fix plan. */
export function AuditReportView({
  report,
  currency,
  industry,
}: {
  report: AuditReport;
  currency: string;
  industry: string;
}) {
  const t = useTranslations("revintel.audit.report");
  const tc = useTranslations("clients");
  const f = useFormat();
  const secs = (s: number | null | undefined) => (s == null ? "—" : f.duration(Math.round(s)));
  const money = (v: number) => f.money({ amount_minor: Math.round(v), currency });
  const industryName = tc.has(`industry.${industry}`) ? tc(`industry.${industry}`) : industry;
  if (report.leads === 0) return <p className="text-muted text-sm">{t("empty")}</p>;
  return (
    <div className="grid gap-4" data-testid="audit-report">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("leads")} value={f.number(report.leads)} />
        <Stat label={t("median")} value={secs(report.median_seconds)} />
        <Stat
          label={t("never")}
          value={f.number(report.never)}
          hint={f.percent(report.leads ? report.never / report.leads : 0)}
          tone="danger"
        />
        <Stat
          label={t("lostSales")}
          value={t("range", { low: f.number(report.lost_sales.low), high: f.number(report.lost_sales.high) })}
          hint={t("inPeriod", { days: report.days })}
          tone="danger"
        />
      </div>

      {report.lost_revenue_minor && report.lost_revenue_per_month && (
        <Card className="border-danger/40">
          <CardContent className="grid gap-1 pt-4">
            <p className="text-sm font-medium">{t("lostRevenue")}</p>
            <p className="text-danger text-2xl font-semibold tabular-nums" data-testid="lost-revenue">
              {t("range", {
                low: money(report.lost_revenue_per_month.low),
                high: money(report.lost_revenue_per_month.high),
              })}
              <span className="text-muted ms-1 text-sm font-normal">{t("perMonth")}</span>
            </p>
            <p className="text-muted text-xs">
              {t("lostRevenueHint", {
                low: money(report.lost_revenue_minor.low),
                high: money(report.lost_revenue_minor.high),
                days: report.days,
              })}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("speedTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {report.buckets.map((b) => (
            <div key={b.key} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2 text-sm">
              <span>{t(`bucket.${b.key}`)}</span>
              <div className="bg-surface-2 h-3 overflow-hidden rounded-full" aria-hidden>
                <div
                  className={cn("h-full rounded-full", BAR_TONE[b.key])}
                  style={{ width: `${Math.round(b.share * 100)}%` }}
                />
              </div>
              <span className="text-end tabular-nums">
                {f.number(b.leads)} <span className="text-muted text-xs">({f.percent(b.share, 0)})</span>
              </span>
            </div>
          ))}
          <p className="text-muted mt-2 text-xs">
            {t("hoursLine", {
              business: secs(report.business_hours.median_seconds),
              after: secs(report.after_hours.median_seconds),
              afterLeads: report.after_hours.leads,
            })}
          </p>
        </CardContent>
      </Card>

      {report.by_source.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("bySource")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("bySource")}</caption>
              <thead className="text-muted text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="p-3 text-start font-medium">
                    {t("source")}
                  </th>
                  <th scope="col" className="p-3 text-end font-medium">
                    {t("leads")}
                  </th>
                  <th scope="col" className="p-3 text-end font-medium">
                    {t("median")}
                  </th>
                  <th scope="col" className="p-3 text-end font-medium">
                    {t("neverRate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.by_source.map((s) => (
                  <tr key={s.source} className="border-border border-b last:border-0">
                    <th scope="row" className="p-3 text-start font-medium">
                      {s.source === "unknown" ? t("unknownSource") : s.source}
                    </th>
                    <td className="p-3 text-end tabular-nums">{f.number(s.leads)}</td>
                    <td className="p-3 text-end tabular-nums">{secs(s.median_seconds)}</td>
                    <td className="p-3 text-end tabular-nums">{f.percent(s.never_rate, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {report.fixes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="text-accent size-5" aria-hidden />
              {t("fixTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid list-decimal gap-2 ps-5 text-sm" data-testid="fix-plan">
              {[...report.fixes]
                .sort((a, b) => a.priority - b.priority)
                .map((x) => (
                  <li key={x.key}>
                    <span className="font-medium">{t(`fix.${x.key}.title`)}</span>{" "}
                    <span className="text-muted">
                      {t(`fix.${x.key}.detail`, {
                        share: x.params.never_rate ? f.percent(Number(x.params.never_rate), 0) : "",
                        time: x.params.median_seconds ? secs(Number(x.params.median_seconds)) : "",
                        source: x.params.source ?? "",
                        count: Number(x.params.after_hours_leads ?? 0),
                      })}
                    </span>
                  </li>
                ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-warning size-5" aria-hidden />
            {t("assumptionsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted grid list-disc gap-1.5 ps-5 text-sm" data-testid="assumptions">
            <li>
              {report.close_rate_from === "entered"
                ? t("assume.closeEntered", {
                    low: f.percent(report.close_rate.low),
                    high: f.percent(report.close_rate.high),
                  })
                : t("assume.closeIndustry", {
                    industry: industryName,
                    low: f.percent(report.close_rate.low),
                    high: f.percent(report.close_rate.high),
                  })}
            </li>
            <li>{t("assume.decay")}</li>
            <li>
              {t("assume.hours", {
                hours: report.assumptions.find((a) => a.key === "business_hours")?.value.replace("-", "–") ?? "",
              })}
            </li>
            <li>{report.lost_revenue_minor ? t("assume.dealEntered") : t("assume.dealMissing")}</li>
            <li>{t("assume.period", { days: report.days })}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="grid gap-0.5 pt-4">
        <span className="text-muted text-xs">{label}</span>
        <span className={cn("text-xl font-semibold tabular-nums", tone === "danger" && "text-danger")}>{value}</span>
        {hint && <span className="text-muted text-xs">{hint}</span>}
      </CardContent>
    </Card>
  );
}
