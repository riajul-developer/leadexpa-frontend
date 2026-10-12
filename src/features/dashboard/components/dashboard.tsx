"use client";

import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { BarChart3, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { useActiveClient, withClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { useSearchState } from "@/shared/hooks/use-search-state";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { localDate } from "@/shared/lib/format";
import { useClients } from "@/shared/lib/lookups";
import { useAgencyCurrency, useDisplayTimeZone } from "@/shared/lib/preferences";
import { dashboardKeys } from "@/shared/lib/query-keys";
import { useMe } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

// Recharts only loads on this route, after first paint (dashboard JS budget).
// Recovered revenue (17.3): the hero number, loaded after the KPIs.
const RecoveredCard = dynamic(() => import("@/features/sequences").then((m) => m.RecoveredCard), { ssr: false });
const LeadsChart = dynamic(() => import("./charts").then((m) => m.LeadsChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
const ComplianceChart = dynamic(() => import("./charts").then((m) => m.ComplianceChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

type Dashboard = Schemas["Dashboard"];
type KPIs = Schemas["KPIs"];
type PeriodKey = "today" | "7d" | "30d" | "month" | "custom";

/** Period → client-local dates (inclusive) in the selected client's (or agency's) timezone. */
export function periodDates(period: PeriodKey, tz: string, now: Date, custom?: { from?: string; to?: string }) {
  const today = localDate(now, tz);
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: localDate(subDays(now, 6), tz), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "custom":
      return { from: custom?.from ?? today, to: custom?.to ?? today };
    default:
      return { from: localDate(subDays(now, 29), tz), to: today };
  }
}

function delta(cur: number | null | undefined, prev: number | null | undefined): "up" | "down" | "flat" | undefined {
  if (cur == null || prev == null) return undefined;
  return cur === prev ? "flat" : cur > prev ? "up" : "down";
}

export function DashboardView() {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const now = useNow();
  const clientId = useActiveClient();
  const { byId } = useClients();
  const { data: me } = useMe();
  const [s, set] = useSearchState(["period", "from", "to"] as const);
  const period = (s.period as PeriodKey | undefined) ?? "30d";
  const displayTz = useDisplayTimeZone();
  const tz = (clientId ? byId.get(clientId)?.timezone : me?.agency?.default_timezone) ?? displayTz;
  const dates = useMemo(
    () => periodDates(period, tz, new Date(now || Date.now()), { from: s.from, to: s.to }),
    [period, tz, s.from, s.to, now],
  );
  const params = { from: dates.from, to: dates.to, client_id: clientId };

  const q = useQuery({
    queryKey: dashboardKeys.view(params),
    queryFn: () => unwrap(api.GET("/v1/dashboard", { params: { query: params } })),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000, // overdue_now is live
  });
  const d = q.data;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border flex rounded-lg border p-0.5" role="radiogroup" aria-label={t("period")}>
            {(["today", "7d", "30d", "month", "custom"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => set({ period: p })}
                className={`rounded-md px-2.5 py-1 text-sm ${period === p ? "bg-primary-soft text-primary font-medium" : "text-muted hover:text-text"}`}
              >
                {t(`periods.${p}`)}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <>
              <Input
                type="date"
                className="h-8 w-auto"
                value={s.from ?? dates.from}
                onChange={(e) => set({ from: e.target.value })}
                aria-label={t("from")}
              />
              <Input
                type="date"
                className="h-8 w-auto"
                value={s.to ?? dates.to}
                onChange={(e) => set({ to: e.target.value })}
                aria-label={t("to")}
              />
            </>
          )}
        </div>
      </div>
      {d && (
        <p className="text-muted flex flex-wrap items-center gap-2 text-xs">
          {t("periodLine", {
            from: d.period.from,
            to: d.period.to,
            tz: d.period.timezone,
            pfrom: d.previous_period.from,
            pto: d.previous_period.to,
          })}
          {d.computed_at && <span>· {t("computed", { when: f.relative(d.computed_at, now || Date.now()) })}</span>}
          {q.isFetching && <RefreshCw className="size-3 animate-spin" aria-hidden />}
        </p>
      )}

      {q.isError && !d ? (
        <EmptyState
          icon={BarChart3}
          title={t("loadFailed")}
          action={<Button onClick={() => void q.refetch()}>{t("retry")}</Button>}
        />
      ) : (
        <>
          <Kpis d={d} loading={q.isPending} clientId={clientId} />
          <RecoveredCard client={clientId ?? undefined} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("charts.leadsOverTime")}</CardTitle>
              </CardHeader>
              <CardContent>{d ? <LeadsChart rows={d.by_day} /> : <Skeleton className="h-64 w-full" />}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("charts.complianceByAgent")}</CardTitle>
              </CardHeader>
              <CardContent>
                {d ? <ComplianceChart rows={d.by_agent} /> : <Skeleton className="h-64 w-full" />}
              </CardContent>
            </Card>
          </div>
          {d && <JunkByCampaign rows={d.by_campaign} />}
          {d && <BreakdownTable title={t("tables.byCampaign")} rows={d.by_campaign} kind="campaign" />}
          {d && (
            <BreakdownTable
              title={t("tables.leaderboard")}
              subtitle={t("tables.leaderboardHint")}
              rows={d.by_agent}
              kind="agent"
            />
          )}
          {d && !clientId && <BreakdownTable title={t("tables.byClient")} rows={d.by_client} kind="client" />}
        </>
      )}
    </div>
  );
}

function Kpis({ d, loading, clientId }: { d?: Dashboard; loading: boolean; clientId?: string }) {
  const t = useTranslations("dashboard.kpi");
  const f = useFormat();
  const agencyCurrency = useAgencyCurrency();
  const k: KPIs | undefined = d?.kpis;
  const p: KPIs | undefined = d?.previous_kpis;
  const def = (key: string) => d?.definitions[key]?.formula;
  const vs = (cur: string, prev: string) => t("vsPrevious", { value: prev, current: cur });
  const coverage = k?.coverage != null ? t("coverage", { pct: f.percent(k.coverage) }) : t("coverageUnknown");
  const money = (m: Schemas["Money"][] | undefined) =>
    m && m.length ? m.map((x) => f.money(x)).join(" + ") : f.money({ amount_minor: 0, currency: agencyCurrency });
  // Several currencies: show the server's conversion into the reporting currency, always labeled with the
  // rates it used (GLOBAL_PROMPT G-4); raw per-currency totals stay visible underneath.
  const conv = k?.converted ?? null;
  const roas = k?.roas ?? conv?.roas ?? null;
  const convertedNote = conv
    ? [
        conv.rates
          .map((r) => t("rate", { from: r.from, to: r.to, rate: f.number(r.rate, { maximumSignificantDigits: 4 }) }))
          .join(", "),
        t("ratesAsOf", { date: conv.rates[0]?.as_of ?? "", source: conv.rates[0]?.source ?? "" }),
        conv.complete ? "" : t("ratesMissing", { currencies: conv.missing_currencies.join(", ") }),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const trend = (cur: number | null | undefined, prev: number | null | undefined, higherIsGood = true) => {
    const dir = delta(cur, prev);
    return dir ? { direction: dir, good: dir === "flat" || (dir === "up") === higherIsGood } : undefined;
  };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard
        loading={loading}
        label={t("leadsReceived")}
        value={k ? f.number(k.leads_received) : "—"}
        secondary={
          k?.leads_junk ? t("junkSplit", { junk: f.number(k.leads_junk), rate: f.percent(k.junk_rate) }) : undefined
        }
        definition={def("leads_received")}
        trend={trend(k?.leads_received, p?.leads_received)}
        trendLabel={k && p ? vs(f.number(k.leads_received), f.number(p.leads_received)) : undefined}
      />
      <KpiCard
        loading={loading}
        label={t("speedToLead")}
        value={k?.speed_to_lead.median_seconds != null ? f.duration(k.speed_to_lead.median_seconds) : "—"}
        secondary={
          k?.speed_to_lead.p90_seconds != null
            ? t("p90", { d: f.duration(k.speed_to_lead.p90_seconds), n: f.number(k.speed_to_lead.leads) })
            : undefined
        }
        definition={def("speed_to_lead")}
        trend={trend(k?.speed_to_lead.median_seconds, p?.speed_to_lead.median_seconds, false)}
        trendLabel={
          k?.speed_to_lead.median_seconds != null && p?.speed_to_lead.median_seconds != null
            ? vs(f.duration(k.speed_to_lead.median_seconds), f.duration(p.speed_to_lead.median_seconds))
            : undefined
        }
      />
      <KpiCard
        loading={loading}
        label={t("slaCompliance")}
        value={f.percent(k?.sla_compliance)}
        definition={def("sla_compliance")}
        secondary={k ? t("breached", { n: f.number(k.sla_breached) }) : undefined}
        trend={trend(k?.sla_compliance, p?.sla_compliance)}
        trendLabel={k && p ? vs(f.percent(k.sla_compliance), f.percent(p.sla_compliance)) : undefined}
      />
      <KpiCard
        loading={loading}
        label={t("overdueNow")}
        value={k?.overdue_now != null ? f.number(k.overdue_now) : "—"}
        definition={def("overdue_now")}
        href={withClient("/leads?stage=new,contacted,qualified", clientId)}
        footnote={k?.overdue_now == null ? t("overdueNotCurrent") : t("live")}
      />
      <KpiCard
        loading={loading}
        label={t("qualifiedRate")}
        value={f.percent(k?.qualified_rate)}
        definition={def("qualified_rate")}
        trend={trend(k?.qualified_rate, p?.qualified_rate)}
        trendLabel={k && p ? vs(f.percent(k.qualified_rate), f.percent(p.qualified_rate)) : undefined}
      />
      <KpiCard
        loading={loading}
        label={t("winRate")}
        value={f.percent(k?.win_rate)}
        definition={def("win_rate")}
        secondary={k ? t("won", { n: f.number(k.leads_won) }) : undefined}
        trend={trend(k?.win_rate, p?.win_rate)}
        trendLabel={k && p ? vs(f.percent(k.win_rate), f.percent(p.win_rate)) : undefined}
      />
      <KpiCard
        loading={loading}
        label={t("revenue")}
        value={conv ? `≈ ${f.money({ amount_minor: conv.revenue_minor, currency: conv.currency })}` : money(k?.revenue)}
        secondary={conv ? money(k?.revenue) : undefined}
        definition={def("revenue")}
        footnote={conv ? `${convertedNote} · ${coverage}` : coverage}
      />
      <KpiCard
        loading={loading}
        label={t("costPerSale")}
        value={
          k?.cost_per_sale
            ? f.money(k.cost_per_sale)
            : conv?.cost_per_sale_minor != null
              ? `≈ ${f.money({ amount_minor: conv.cost_per_sale_minor, currency: conv.currency })}`
              : "—"
        }
        secondary={
          roas != null
            ? t("roas", { x: f.number(roas, { maximumFractionDigits: 1 }) })
            : k?.cpl
              ? t("cpl", { v: f.money(k.cpl) })
              : t("noSpend")
        }
        definition={def("cost_per_sale")}
        footnote={conv ? `${convertedNote} · ${coverage}` : coverage}
      />
    </div>
  );
}

function BreakdownTable({
  title,
  subtitle,
  rows,
  kind,
}: {
  title: string;
  subtitle?: string;
  rows: Schemas["Breakdown"][];
  kind: "campaign" | "agent" | "client";
}) {
  const t = useTranslations("dashboard.tables");
  const f = useFormat();
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-muted text-start">
              <th scope="col" className="py-2 font-medium">
                {t(`name.${kind}`)}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("leads")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("contactRate")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("compliance")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("won")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("revenue")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? `none-${i}`} className="border-border border-t">
                <th scope="row" className="py-2 text-start font-normal">
                  {r.name || (kind === "agent" ? t("unassigned") : t("none"))}
                </th>
                <td className="py-2 text-end tabular-nums">{f.number(r.leads_received)}</td>
                <td className="py-2 text-end tabular-nums">{f.percent(r.contact_rate)}</td>
                <td className="py-2 text-end tabular-nums">{f.percent(r.sla_compliance)}</td>
                <td className="py-2 text-end tabular-nums">{f.number(r.leads_won)}</td>
                <td className="py-2 text-end tabular-nums">
                  {r.revenue_minor != null && r.currency
                    ? f.money({ amount_minor: r.revenue_minor, currency: r.currency })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** Junk rate per campaign, worst first (17.0.1): the ads producing fake leads are the ones to pause. */
function JunkByCampaign({ rows }: { rows: Schemas["Breakdown"][] }) {
  const t = useTranslations("dashboard.junk");
  const f = useFormat();
  const withJunk = rows
    .filter((r) => (r.leads_junk ?? 0) > 0)
    .sort((a, b) => (b.junk_rate ?? 0) - (a.junk_rate ?? 0) || (b.leads_junk ?? 0) - (a.leads_junk ?? 0));
  if (withJunk.length === 0) return null;
  const worst = withJunk[0]!;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 overflow-x-auto">
        {(worst.junk_rate ?? 0) >= 0.3 && (
          <p role="status" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
            {t("callout", { name: worst.name || t("noCampaign"), rate: f.percent(worst.junk_rate) })}
          </p>
        )}
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-2 text-start font-medium">
                {t("campaign")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("valid")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("junk")}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t("rate")}
              </th>
            </tr>
          </thead>
          <tbody>
            {withJunk.map((r) => (
              <tr key={r.id ?? "none"} className="border-border border-t">
                <td className="py-2">{r.name || t("noCampaign")}</td>
                <td className="py-2 text-end tabular-nums">{f.number(r.leads_received)}</td>
                <td className="py-2 text-end tabular-nums">{f.number(r.leads_junk ?? 0)}</td>
                <td
                  className={
                    "py-2 text-end font-medium tabular-nums" + ((r.junk_rate ?? 0) >= 0.3 ? " text-danger" : "")
                  }
                >
                  {f.percent(r.junk_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
