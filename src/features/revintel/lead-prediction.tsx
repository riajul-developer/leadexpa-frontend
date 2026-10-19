"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import type { Schemas } from "@/shared/lib/api/client";
import { Card, Skeleton } from "@/shared/ui/primitives";

import { useLeadPrediction } from "./api";

type Lead = Schemas["LeadDetail"];

export function LeadPrediction({ lead, timeZone }: { lead: Lead; timeZone: string }) {
  const t = useTranslations("revintel.prediction");
  const f = useFormat();
  const open = lead.stage !== "won" && lead.stage !== "lost";
  const q = useLeadPrediction(lead.id, open);
  if (!open) return null;
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  const p = q.data?.data;
  if (!p) return null;
  const money = (v: number) => f.money({ amount_minor: v, currency: p.currency });
  return (
    <Card className="grid gap-2 p-3" data-testid="lead-prediction">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="text-accent size-4" aria-hidden />
        {t("title")}
      </h3>
      {p.basis === "none" ? (
        <p className="text-muted text-sm">{t("noHistory")}</p>
      ) : (
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-muted text-xs">{t("value")}</dt>
            <dd className="font-semibold tabular-nums">{money(p.value_minor)}</dd>
            <dd className="text-muted text-xs tabular-nums">
              {t("range", { low: money(p.value_low), high: money(p.value_high) })}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("winChance")}</dt>
            <dd className="font-semibold tabular-nums">{f.percent(p.win_probability)}</dd>
            <dd className="text-muted text-xs tabular-nums">{t("expected", { value: money(p.expected_minor) })}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("close")}</dt>
            <dd className="font-semibold">{p.close_at ? f.dateTime(p.close_at, timeZone, "date") : "—"}</dd>
            {p.close_low && p.close_high && (
              <dd className="text-muted text-xs">
                {t("between", {
                  from: f.dateTime(p.close_low, timeZone, "date"),
                  to: f.dateTime(p.close_high, timeZone, "date"),
                })}
              </dd>
            )}
          </div>
        </dl>
      )}
      <p className="text-muted text-xs">{t(`basis.${p.basis}`, { count: p.sample })}</p>
    </Card>
  );
}
