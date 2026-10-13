"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useForecast } from "./api";

const ForecastChart = dynamic(() => import("./forecast-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

/** Pipeline forecast for one client: range chart and the weighted pipeline by stage (17.11). */
export function ForecastPanel({ clientId }: { clientId?: string }) {
  const t = useTranslations("insights.forecast");
  const ts = useTranslations("stage");
  const f = useFormat();
  const q = useForecast(clientId);
  if (!clientId) return <EmptyState title={t("pickClient")} />;
  const fc = q.data;
  if (!fc) return <Skeleton className="h-80 w-full" />;
  const money = (v: number) => f.money({ amount_minor: v, currency: fc.currency });
  const at = (days: number) => fc.bands.find((b) => b.days === days) ?? fc.bands[fc.bands.length - 1];
  const month = at(28);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {month && (
            <p className="text-sm" data-forecast="4w">
              {t("summary", { p50: money(month.p50_minor), p10: money(month.p10_minor), p90: money(month.p90_minor) })}
            </p>
          )}
          <ForecastChart forecast={fc} />
          <p className="text-muted text-xs">{t("method", { sims: f.number(fc.simulations) })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("pipeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {fc.stages.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-start">
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("col.stage")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("col.open")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("col.winRate")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("col.value")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("col.weighted")}
                    </th>
                    <th scope="col" className="py-2 text-end font-medium">
                      {t("col.days")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fc.stages.map((s) => (
                    <tr key={s.stage} className="border-border border-t tabular-nums" data-stage={s.stage}>
                      <th scope="row" className="py-2 text-start font-normal">
                        {ts(s.stage)}
                      </th>
                      <td className="text-end">{f.number(s.open)}</td>
                      <td className="text-end" title={t("sample", { n: s.sample })}>
                        {f.percent(s.win_probability)}
                      </td>
                      <td className="text-end">{money(s.value_minor)}</td>
                      <td className="text-end font-medium">{money(s.weighted_minor)}</td>
                      <td className="text-end">
                        {s.median_days_to_win == null ? "—" : f.number(s.median_days_to_win)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
