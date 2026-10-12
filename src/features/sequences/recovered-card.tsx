"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { useCan } from "@/shared/lib/session";
import { Card, CardContent, Skeleton } from "@/shared/ui/primitives";

import { useRecoverySummary, type Recovered } from "./api";

/**
 * Recovered revenue (17.3), the hero number: revenue from leads a sequence worked on, and how much of it beat the
 * holdout group that was left alone ("+৳1,84,000 vs. holdout").
 */
export function RecoveredCard({ client, days = 90 }: { client?: string; days?: number }) {
  const canRead = useCan("report.read");
  const q = useRecoverySummary(client, days);
  if (!canRead) return null;
  if (q.isPending) return <Skeleton className="h-28" />;
  if (!q.data) return null;
  return <RecoveredView r={q.data} days={days} />;
}

export function RecoveredView({ r, days }: { r: Recovered; days?: number }) {
  const t = useTranslations("sequences.recovered");
  const f = useFormat();
  const money = (minor: number) => f.money({ amount_minor: minor, currency: r.currency });
  return (
    <Card>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1">
          <p className="text-muted flex items-center gap-2 text-sm">
            <TrendingUp className="text-success size-4" aria-hidden />
            {days ? t("titleDays", { days }) : t("title")}
          </p>
          <p className="text-3xl font-semibold tabular-nums">{money(r.treated_revenue_minor)}</p>
          <p className="text-muted text-sm">
            {t("leads", { converted: r.treated_converted, leads: r.treated_leads })}
            {r.treated_conversion_rate != null && ` · ${f.percent(r.treated_conversion_rate)}`}
          </p>
        </div>
        <div className="grid gap-1 text-sm sm:text-end">
          {r.incremental_revenue_minor != null ? (
            <>
              <p
                className={`text-lg font-semibold tabular-nums ${r.incremental_revenue_minor >= 0 ? "text-success" : "text-danger"}`}
              >
                {r.incremental_revenue_minor >= 0 ? "+" : ""}
                {money(r.incremental_revenue_minor)} {t("vsHoldout")}
              </p>
              <p className="text-muted">
                {t("holdout", { converted: r.holdout_converted, leads: r.holdout_leads })}
                {r.holdout_conversion_rate != null && ` · ${f.percent(r.holdout_conversion_rate)}`}
              </p>
            </>
          ) : (
            <p className="text-muted max-w-56">{t("noHoldout")}</p>
          )}
          {!r.complete && (
            <p className="text-warning text-xs">{t("missingRates", { currencies: r.missing_currencies.join(", ") })}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
