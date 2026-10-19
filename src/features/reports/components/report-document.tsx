// Server-compatible (no client hooks, no chart library): also rendered to PDF.
import { useTranslations } from "next-intl";

import { dir, type AppLocale } from "@/shared/config/locales";
import type { Schemas } from "@/shared/lib/api/client";
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
  type FormatOptions,
} from "@/shared/lib/format";

type Snapshot = Schemas["ReportSnapshot"];

function DayBars({ rows, label }: { rows: Schemas["Breakdown"][]; label: string }) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.leads_received));
  const w = 600;
  const h = 140;
  const bw = w / rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="h-auto w-full" role="img" aria-label={label}>
      {rows.map((r, i) => {
        const bh = (r.leads_received / max) * h;
        const wonH = (r.leads_won / max) * h;
        return (
          <g key={r.day ?? i}>
            <rect
              x={i * bw + 1}
              y={h - bh}
              width={Math.max(1, bw - 2)}
              height={bh}
              rx={2}
              fill="var(--c-primary, #7a1a12)"
              opacity={0.35}
            />
            <rect
              x={i * bw + 1}
              y={h - wonH}
              width={Math.max(1, bw - 2)}
              height={wonH}
              rx={2}
              fill="var(--c-success, #0f7a3d)"
            />
            {(rows.length <= 14 || i % Math.ceil(rows.length / 10) === 0) && (
              <text x={i * bw + bw / 2} y={h + 14} fontSize={10} textAnchor="middle" fill="var(--c-muted, #5b6472)">
                {r.day?.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-border break-inside-avoid rounded-lg border p-3">
      <p className="text-muted text-xs">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted text-xs">{sub}</p>}
    </div>
  );
}

export function ReportDocument({
  snapshot: s,
  title,
  locale,
  print = false,
}: {
  snapshot: Snapshot;
  title: string;
  locale: AppLocale;
  print?: boolean;
}) {
  const t = useTranslations("report");
  const o: FormatOptions = { locale, digits: "latn" };
  const n = (v: number) => formatNumber(v, o);
  const pct = (v: number | null | undefined) => formatPercent(v, o);
  const dur = (v: number | null | undefined) =>
    v == null ? "—" : formatDuration(v, o, { d: t("units.d"), h: t("units.h"), m: t("units.m"), s: t("units.s") });
  const money = (m: Schemas["Money"][] | Schemas["Money"] | null | undefined) =>
    Array.isArray(m)
      ? m.length
        ? m.map((x) => formatMoney(x, o)).join(" + ")
        : formatMoney({ amount_minor: 0, currency: s.client.currency }, o)
      : formatMoney(m ?? null, o);
  const k = s.kpis;

  return (
    <article
      lang={locale}
      dir={dir(locale)}
      className={print ? "report-print mx-auto max-w-[190mm] text-[11pt]" : "mx-auto grid max-w-3xl gap-6"}
    >
      <header className="border-border grid gap-1 border-b pb-4">
        <p className="text-muted text-sm">{t("preparedBy", { agency: s.agency.name })}</p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted text-sm">
          {s.client.name} · {s.period.from} – {s.period.to} ({s.period.timezone})
        </p>
      </header>

      <section className="grid break-inside-avoid gap-3" aria-labelledby="r-headline">
        <h2 id="r-headline" className="text-lg font-semibold">
          {t("headline")}
        </h2>
        <p className="text-base">
          {t("headlineText", {
            leads: n(k.leads_received),
            contacted: pct(k.contact_rate),
            speed: dur(k.speed_to_lead.median_seconds),
            won: n(k.leads_won),
            revenue: money(k.revenue),
          })}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label={t("kpi.leads")}
            value={n(k.leads_received)}
            sub={t("kpi.previous", { v: n(s.previous_kpis.leads_received) })}
          />
          <Kpi label={t("kpi.followedUp")} value={pct(k.contact_rate)} />
          <Kpi label={t("kpi.speed")} value={dur(k.speed_to_lead.median_seconds)} sub={t("kpi.median")} />
          <Kpi label={t("kpi.qualified")} value={pct(k.qualified_rate)} />
          <Kpi label={t("kpi.sales")} value={n(k.leads_won)} sub={t("kpi.winRate", { v: pct(k.win_rate) })} />
          <Kpi label={t("kpi.revenue")} value={money(k.revenue)} />
          <Kpi label={t("kpi.cpl")} value={k.cpl ? money(k.cpl) : "—"} />
          <Kpi
            label={t("kpi.costPerSale")}
            value={k.cost_per_sale ? money(k.cost_per_sale) : "—"}
            sub={
              k.roas != null ? t("kpi.roas", { v: formatNumber(k.roas, o, { maximumFractionDigits: 1 }) }) : undefined
            }
          />
        </div>
      </section>

      {s.by_day.length > 0 && (
        <section className="grid break-inside-avoid gap-2" aria-labelledby="r-trend">
          <h2 id="r-trend" className="text-lg font-semibold">
            {t("trend")}
          </h2>
          <DayBars rows={s.by_day} label={t("trend")} />
          <p className="text-muted text-xs">{t("trendLegend")}</p>
        </section>
      )}

      {s.by_campaign.length > 0 && (
        <section className="grid break-inside-avoid gap-2" aria-labelledby="r-campaigns">
          <h2 id="r-campaigns" className="text-lg font-semibold">
            {t("byCampaign")}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-start">
                <th scope="col" className="py-1.5 font-medium">
                  {t("col.campaign")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("col.leads")}
                </th>
                {s.by_campaign.some((r) => (r.leads_junk ?? 0) > 0) && (
                  <th scope="col" className="py-1.5 text-end font-medium">
                    {t("col.junk")}
                  </th>
                )}
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("col.followedUp")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("col.sales")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("col.revenue")}
                </th>
              </tr>
            </thead>
            <tbody>
              {s.by_campaign.map((r, i) => (
                <tr key={r.id ?? i} className="border-border border-t">
                  <th scope="row" className="py-1.5 text-start font-normal">
                    {r.name || t("noCampaign")}
                  </th>
                  <td className="py-1.5 text-end tabular-nums">{n(r.leads_received)}</td>
                  {s.by_campaign.some((r) => (r.leads_junk ?? 0) > 0) && (
                    <td className="py-1.5 text-end tabular-nums">
                      {n(r.leads_junk ?? 0)} ({pct(r.junk_rate)})
                    </td>
                  )}
                  <td className="py-1.5 text-end tabular-nums">{pct(r.contact_rate)}</td>
                  <td className="py-1.5 text-end tabular-nums">{n(r.leads_won)}</td>
                  <td className="py-1.5 text-end tabular-nums">
                    {r.revenue_minor != null && r.currency
                      ? formatMoney({ amount_minor: r.revenue_minor, currency: r.currency }, o)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {s.narrative && (
        <section className="grid break-inside-avoid gap-2" aria-labelledby="r-notes">
          <h2 id="r-notes" className="text-lg font-semibold">
            {t("recommendations")}
          </h2>
          {/* Plain text, never HTML. */}
          <p className="whitespace-pre-wrap">{s.narrative}</p>
        </section>
      )}

      {s.leads && s.leads.length > 0 && (
        <section className="grid gap-2" aria-labelledby="r-leads">
          <h2 id="r-leads" className="text-lg font-semibold">
            {t("leads")}
          </h2>
          <p className="text-muted text-xs">{t("leadsMasked")}</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted text-start">
                <th scope="col" className="py-1 font-medium">
                  {t("col.received")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("col.name")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("col.phone")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("col.stage")}
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {t("col.response")}
                </th>
              </tr>
            </thead>
            <tbody>
              {s.leads.map((l, i) => (
                <tr key={i} className="border-border border-t">
                  <td className="py-1">{formatDateTime(l.received_at, s.client.timezone, o, "short")}</td>
                  <td className="py-1">{l.name}</td>
                  <td className="py-1 tabular-nums">{l.phone ?? "—"}</td>
                  <td className="py-1">{t(`stage.${l.stage}`)}</td>
                  <td className="py-1 text-end">{dur(l.first_response_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.leads_truncated && <p className="text-muted text-xs">{t("leadsTruncated")}</p>}
        </section>
      )}

      <footer className="border-border text-muted grid break-inside-avoid gap-1 border-t pt-4 text-xs">
        <p>{k.coverage != null ? t("coverage", { pct: pct(k.coverage) }) : t("coverageUnknown")}</p>
        <p>
          {t("definitions", {
            version: s.definition_version,
            when: formatDateTime(s.generated_at, s.client.timezone, o),
          })}
        </p>
      </footer>
    </article>
  );
}
