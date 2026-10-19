"use client";

import { Activity } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { Field } from "@/shared/ui/field";
import { NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useAgencySLA, useServiceStatus } from "../api";

/** The last six calendar months (UTC), newest first; the first is partial. */
function recentMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function SLACard() {
  const t = useTranslations("serviceStatus.sla");
  const ts = useTranslations("serviceStatus");
  const locale = useLocale();
  const fmt = useFormat();
  const months = useMemo(recentMonths, []);
  const [month, setMonth] = useState(months[1] ?? months[0] ?? "");
  const status = useServiceStatus();
  const sla = useAgencySLA(month);
  const monthName = (m: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${m}-01T00:00:00Z`),
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4" data-testid="sla-card">
        {status.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !status.data?.available ? (
          <p className="text-muted text-sm">{t("notMeasured")}</p>
        ) : (
          <div className="grid gap-2">
            <p className="text-sm">
              {t("region", { region: status.data.region })}{" "}
              <Badge
                tone={
                  status.data.state === "operational"
                    ? "success"
                    : status.data.state === "no_data"
                      ? "neutral"
                      : "warning"
                }
              >
                {ts(`state.${status.data.state}`)}
              </Badge>
            </p>
            <ul className="text-muted grid gap-1 text-xs">
              {status.data.components.map((c) => (
                <li key={c.key}>
                  {ts(`components.${c.key}`)}: {ts(`state.${c.state}`)} · {ts("uptime90", { value: c.uptime_90d })}
                </li>
              ))}
            </ul>
            <Link href="/status" target="_blank" className="text-primary w-fit text-sm underline">
              {t("statusPage")}
            </Link>
          </div>
        )}
        <Field label={t("month")} className="w-56">
          <NativeSelect value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {sla.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : sla.isError ? (
          <p className="text-muted text-sm">
            {isApiError(sla.error) && sla.error.code === "status_unavailable" ? t("notMeasured") : t("failed")}
          </p>
        ) : (
          sla.data && (
            <dl className="grid gap-1 text-sm" data-testid="sla-report">
              <div>
                {t("availability", {
                  value: fmt.number(sla.data.availability, { maximumFractionDigits: 3 }),
                  target: fmt.number(sla.data.target, { maximumFractionDigits: 3 }),
                  tier: t(`tier.${sla.data.tier}`),
                })}
              </div>
              <div>
                <Badge tone={sla.data.met ? "success" : "danger"}>{sla.data.met ? t("met") : t("missed")}</Badge>
                {!sla.data.met && sla.data.credit_percent > 0 && (
                  <span className="ms-2">{t("credit", { percent: sla.data.credit_percent })}</span>
                )}
              </div>
              <div className="text-muted text-xs">
                {t("minutes", {
                  measured: sla.data.measured_minutes,
                  down: sla.data.down_minutes,
                  excluded: sla.data.excluded_minutes,
                })}
                {sla.data.partial && <> · {t("partial")}</>}
              </div>
            </dl>
          )
        )}
      </CardContent>
    </Card>
  );
}
