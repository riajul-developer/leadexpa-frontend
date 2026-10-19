"use client";

import { useTranslations } from "next-intl";
import { Fragment } from "react";

import { useFormat } from "@/shared/hooks/use-format";

import type { ReviewFact } from "./audit-api";

const REF = /\{\{\s*([a-z0-9_.:-]+)\s*\}\}/g;

export function useFactFormatter() {
  const f = useFormat();
  const t = useTranslations("revintel.review");
  return (fact: ReviewFact | undefined): string => {
    if (!fact) return "—";
    if (fact.kind === "text") return fact.label ?? "";
    if (fact.kind === "period") {
      const [from, to] = (fact.label ?? "").split("/");
      return from && to
        ? t("periodValue", {
            from: f.dateTime(from + "T12:00:00Z", "UTC", "date"),
            to: f.dateTime(to + "T12:00:00Z", "UTC", "date"),
          })
        : "";
    }
    const v = fact.value;
    if (v == null) return t("notAvailable");
    switch (fact.kind) {
      case "rate":
        return f.percent(v);
      case "money":
        return f.money({ amount_minor: Math.round(v), currency: fact.currency ?? "USD" });
      case "change":
        return (v > 0 ? "+" : "") + f.percent(v);
      case "points":
        return t("points", { value: (v > 0 ? "+" : "") + f.number(Math.round(v * 1000) / 10) });
      default:
        return f.number(v);
    }
  };
}

export function FactText({ text, facts }: { text: string; facts: ReviewFact[] }) {
  const t = useTranslations("revintel.review");
  const fmt = useFactFormatter();
  const byKey = new Map(facts.map((x) => [x.key, x]));
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    parts.push(<Fragment key={`t${last}`}>{text.slice(last, m.index)}</Fragment>);
    const fact = byKey.get(m[1]!);
    const source =
      fact && fact.metric
        ? t("source", {
            metric: t.has(`metric.${fact.metric}`) ? t(`metric.${fact.metric}`) : fact.metric,
            scope: t(`scope.${fact.scope}`),
          })
        : undefined;
    parts.push(
      <abbr
        key={`f${m.index}`}
        title={source}
        data-fact={m[1]}
        className={
          fact?.metric
            ? "decoration-accent cursor-help font-semibold underline decoration-dotted underline-offset-2"
            : "font-semibold"
        }
      >
        {fmt(fact)}
      </abbr>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}
