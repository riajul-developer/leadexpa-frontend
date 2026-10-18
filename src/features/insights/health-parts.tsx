"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";

import type { Anomaly } from "./api";

const BAND_COLOR = { healthy: "text-success", watch: "text-warning", at_risk: "text-danger" } as const;
type Band = keyof typeof BAND_COLOR;

/** Daily scores (0–100) as a line; the client page and the overview rows both draw it. */
export function TrendLine({ points, label, className }: { points: number[]; label: string; className?: string }) {
  const w = 300;
  const h = 48;
  const step = w / Math.max(points.length - 1, 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p / 100) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("text-primary h-12 w-full", className)}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The health score as a ring (17.10). */
export function HealthRing({ score, band, size = 96 }: { score: number | null; band: Band | null; size?: number }) {
  const t = useTranslations("insights.health");
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={score == null ? t("noScore") : t("ringLabel", { score, band: t(`band.${band}`) })}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-surface-2" />
        {score != null && band && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={cn("stroke-current", BAND_COLOR[band])}
            strokeDasharray={`${(pct / 100) * c} ${c}`}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className={cn("block font-bold tabular-nums", size >= 80 ? "text-2xl" : "text-sm")}>
            {score ?? "—"}
          </span>
          {size >= 80 && band && <span className={cn("block text-xs", BAND_COLOR[band])}>{t(`band.${band}`)}</span>}
        </span>
      </span>
    </div>
  );
}

/** One anomaly in plain language: "Lead volume dropped 86% on Tue 12 Oct — Eid offer paused?" */
export function useAnomalyText() {
  const t = useTranslations("insights.anomaly");
  const f = useFormat();
  return (a: Anomaly, tz: string) => {
    const change = a.expected ? Math.round((Math.abs(a.actual - a.expected) / a.expected) * 100) : 0;
    const when = f.dateTime(`${a.day}T12:00:00Z`, tz, "date");
    const base = t(`${a.direction}`, { metric: t(`metric.${a.metric}`), change, day: when });
    const h = a.hint as { campaign?: string; spend_stopped?: boolean } | undefined;
    if (h?.campaign)
      return `${base} — ${h.spend_stopped ? t("paused", { campaign: h.campaign }) : t("campaign", { campaign: h.campaign })}`;
    return base;
  };
}
