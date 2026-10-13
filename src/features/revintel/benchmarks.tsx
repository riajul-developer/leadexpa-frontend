"use client";

import { Info, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { useCan } from "@/shared/lib/session";
import { Switch } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { type Benchmarks, useBenchmarks, useBenchSettings, useCalibration, useSetBenchOptIn } from "./api";

type Metric = Benchmarks["metrics"][number];

/** Insights › Benchmarks: where a client stands among agencies that opted in (10.3, k-anonymous groups only). */
export function BenchmarksPanel({ clientId }: { clientId?: string }) {
  const t = useTranslations("revintel.benchmarks");
  const canChange = useCan("agency.update");
  const settings = useBenchSettings();
  const setOptIn = useSetBenchOptIn();
  const q = useBenchmarks(clientId);
  const optedIn = settings.data?.opt_in ?? false;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="text-accent size-5" aria-hidden />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="grid gap-0.5" id="bench-opt-in">
              <span className="font-medium">{t("optIn")}</span>
              <span className="text-muted text-xs">{t("optInHint")}</span>
            </span>
            <Switch
              checked={optedIn}
              disabled={!canChange || setOptIn.isPending || settings.isPending}
              onCheckedChange={(c) => setOptIn.mutate(c)}
              aria-labelledby="bench-opt-in"
            />
          </div>
          {!canChange && <p className="text-muted text-xs">{t("adminOnly")}</p>}
        </CardContent>
      </Card>
      {optedIn &&
        (q.isPending || !q.data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              {q.data.metrics.map((m) => (
                <MetricCard key={m.metric} m={m} />
              ))}
            </div>
            <p className="text-muted flex gap-2 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{q.data.methodology}</span>
            </p>
          </>
        ))}
    </div>
  );
}

function MetricCard({ m }: { m: Metric }) {
  const t = useTranslations("revintel.benchmarks");
  const tc = useTranslations("clients");
  const locale = useLocale();
  const f = useFormat();
  const industry = tc.has(`industry.${m.industry}`) ? tc(`industry.${m.industry}`) : m.industry;
  let country = m.country;
  try {
    country = new Intl.DisplayNames([locale], { type: "region" }).of(m.country) ?? m.country;
  } catch {
    // an unknown code stays as it is
  }
  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : m.metric === "speed_to_lead" ? f.duration(Math.round(v)) : f.percent(v);
  const where = m.country ? t("groupCountry", { industry, country }) : t("groupAll", { industry });
  return (
    <Card data-benchmark={m.metric}>
      <CardContent className="grid gap-1.5 pt-4">
        <span className="text-muted text-xs">{t(`metric.${m.metric}`)}</span>
        <span className="text-2xl font-semibold tabular-nums">{fmt(m.value)}</span>
        {m.available && m.beats != null ? (
          <>
            <p className="text-sm font-medium">{t(`beats.${m.metric}`, { share: f.percent(m.beats, 0) })}</p>
            <p className="text-muted text-xs">
              {t("spread", { p10: fmt(m.p10), median: fmt(m.median), p90: fmt(m.p90) })}
            </p>
            <p className="text-muted text-xs">{t("group", { where, count: m.agencies })}</p>
          </>
        ) : (
          <p className="text-muted text-sm">{t(`reason.${m.reason ?? "not_enough_agencies"}`)}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Insights › Forecast: how accurate the deal predictions behind the forecast have been. */
export function CalibrationCard({ clientId }: { clientId?: string }) {
  const t = useTranslations("revintel.calibration");
  const f = useFormat();
  const q = useCalibration(clientId);
  if (!clientId) return null;
  if (q.isPending) return <Skeleton className="h-32 w-full" />;
  const r = q.data?.result;
  if (!r) return null;
  return (
    <Card data-testid="calibration">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {r.leads === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <>
            <p className="text-sm">
              {t("summary", {
                leads: r.leads,
                brier: r.brier == null ? "—" : f.number(r.brier, { maximumFractionDigits: 3 }),
              })}
              {r.value_error != null &&
                ` ${t("valueError", { error: f.percent(r.value_error, 0), count: r.value_sample })}`}
            </p>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("table")}</caption>
              <thead className="text-muted text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="p-2 text-start font-medium">
                    {t("band")}
                  </th>
                  <th scope="col" className="p-2 text-end font-medium">
                    {t("leads")}
                  </th>
                  <th scope="col" className="p-2 text-end font-medium">
                    {t("predicted")}
                  </th>
                  <th scope="col" className="p-2 text-end font-medium">
                    {t("actual")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.buckets.map((b) => (
                  <tr key={b.from} className="border-border border-b last:border-0">
                    <th scope="row" className="p-2 text-start font-normal tabular-nums">
                      {f.percent(b.from, 0)}–{f.percent(b.to, 0)}
                    </th>
                    <td className="p-2 text-end tabular-nums">{f.number(b.leads)}</td>
                    <td className="p-2 text-end tabular-nums">{f.percent(b.predicted, 0)}</td>
                    <td className="p-2 text-end tabular-nums">{f.percent(b.actual, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="text-muted text-xs">{q.data?.method}</p>
      </CardContent>
    </Card>
  );
}
