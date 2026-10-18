"use client";

import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/cn";

import { Tooltip } from "./overlays";
import { Card, Skeleton } from "./primitives";

const ICON_TONES = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/**
 * One KPI as the API defines it. `definition` is the server's formula text (shown verbatim);
 * `delta` is the server's previous-period value rendered by the caller — the card never computes metrics.
 */
export function KpiCard({
  label,
  value,
  secondary,
  definition,
  trend,
  trendLabel,
  footnote,
  href,
  loading,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  definition?: string;
  /** Direction of change vs. the previous period, and whether that direction is good. */
  trend?: { direction: "up" | "down" | "flat"; good: boolean };
  trendLabel?: React.ReactNode;
  footnote?: React.ReactNode;
  href?: string;
  loading?: boolean;
  /** A related icon, drawn large and faded in the corner behind the numbers. */
  icon?: LucideIcon;
  tone?: keyof typeof ICON_TONES;
  className?: string;
}) {
  const body = (
    <Card
      className={cn(
        "flex h-full flex-col gap-1 p-4",
        Icon && "relative overflow-hidden",
        href && "hover:border-primary transition-colors",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn("pointer-events-none absolute -end-3 -bottom-3 size-20 opacity-10", ICON_TONES[tone])}
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      <div className="text-muted flex items-center gap-1 text-sm">
        <span>{label}</span>
        {definition && (
          <Tooltip content={definition}>
            <button
              type="button"
              className="hover:text-text -m-1 inline-flex size-6 items-center justify-center rounded"
              aria-label={definition}
            >
              <Info className="size-3.5" aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
      {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-semibold tabular-nums">{value}</div>}
      {secondary && <div className="text-muted text-sm">{secondary}</div>}
      {trend && trendLabel && !loading && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs",
            trend.direction === "flat" ? "text-muted" : trend.good ? "text-success" : "text-danger",
          )}
        >
          {trend.direction === "up" ? (
            <ArrowUpRight className="size-3.5" aria-hidden />
          ) : trend.direction === "down" ? (
            <ArrowDownRight className="size-3.5" aria-hidden />
          ) : null}
          {trendLabel}
        </div>
      )}
      {footnote && <div className="text-muted mt-auto pt-1 text-xs">{footnote}</div>}
    </Card>
  );
  return href ? (
    <a href={href} className="rounded-card block">
      {body}
    </a>
  ) : (
    body
  );
}
