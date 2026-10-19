"use client";

// Loaded lazily (next/dynamic) so Recharts never ships with other routes.
import { useTranslations } from "next-intl";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useFormat } from "@/shared/hooks/use-format";

import type { Forecast } from "./api";

/** Cumulative revenue by week: the p10–p90 band with the p50 line (17.11). */
export default function ForecastChart({ forecast }: { forecast: Forecast }) {
  const t = useTranslations("insights.forecast");
  const f = useFormat();
  const money = (v: number) => f.money({ amount_minor: v, currency: forecast.currency });
  const data = forecast.bands.map((b) => ({ week: b.days / 7, band: [b.p10_minor, b.p90_minor], p50: b.p50_minor }));
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--c-border)" vertical={false} />
          <XAxis dataKey="week" tickFormatter={(w: number) => t("weekShort", { week: w })} fontSize={12} />
          <YAxis tickFormatter={(v: number) => f.number(v / 100, { notation: "compact" })} fontSize={12} width={48} />
          <Tooltip
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 4 }}
            formatter={(v, name) =>
              Array.isArray(v)
                ? [`${money(Number(v[0]))} – ${money(Number(v[1]))}`, t("range")]
                : [money(Number(v ?? 0)), name === "p50" ? t("likely") : String(name)]
            }
            labelFormatter={(w) => t("byWeek", { week: Number(w) })}
          />
          <Area dataKey="band" stroke="none" fill="var(--c-primary)" fillOpacity={0.15} isAnimationActive={false} />
          <Line dataKey="p50" stroke="var(--c-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
