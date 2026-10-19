"use client";

import { useTranslations } from "next-intl";

import { type AskQuery, METRICS, STAGES } from "@/shared/lib/report-query";
import { Checkbox } from "@/shared/ui/controls";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";

import type { ReportWidget } from "./api";
import { fitQuery, problem, RULES, WIDGET_TYPES, type WidgetType } from "./grid";
import { autoTitle } from "./widget-view";

const TOPS = [0, 3, 5, 10] as const;

/** One widget's settings: what it shows and how. Changing the type reshapes the query to fit. */
export function WidgetSettings({ widget, onChange }: { widget: ReportWidget; onChange: (w: ReportWidget) => void }) {
  const t = useTranslations("reportBuilder");
  const ta = useTranslations("ask");
  const ts = useTranslations("stage");
  const q = widget.query;
  const type = widget.type as WidgetType;
  const setQ = (patch: Partial<AskQuery>) => q && onChange({ ...widget, query: { ...q, ...patch } });
  const setF = (patch: Partial<AskQuery["filters"]>) => q && setQ({ filters: { ...q.filters, ...patch } });
  const issue = problem(widget);

  return (
    <div className="grid gap-4 p-4">
      <Field label={t("settings.type")}>
        <NativeSelect
          value={widget.type}
          onChange={(e) => {
            const next = e.target.value as WidgetType;
            onChange({ ...widget, type: next, query: fitQuery(next, q), text: next === "text" ? widget.text : "" });
          }}
        >
          {WIDGET_TYPES.map((k) => (
            <option key={k} value={k}>
              {t(`types.${k}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <p className="text-muted -mt-2 text-xs">{t(`typeHints.${type}`)}</p>

      <Field label={t("settings.title")} hint={t("settings.titleHint")}>
        <Input
          value={widget.title}
          maxLength={120}
          placeholder={autoTitle(ta, t, { ...widget, title: "" }) || t("board.untitled")}
          onChange={(e) => onChange({ ...widget, title: e.target.value })}
        />
      </Field>

      {type === "text" && (
        <Field label={t("settings.text")} error={issue === "text" ? t("settings.textRequired") : undefined}>
          <Textarea
            rows={6}
            maxLength={2000}
            value={widget.text}
            onChange={(e) => onChange({ ...widget, text: e.target.value })}
          />
        </Field>
      )}

      {q && type !== "text" && type !== "leads" && (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t("settings.metrics", { min: RULES[type].min, max: RULES[type].max })}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map((m) => {
                const on = q.metrics.includes(m);
                const full = q.metrics.length >= RULES[type].max;
                const last = on && q.metrics.length <= RULES[type].min;
                return (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={on}
                      disabled={(!on && full && RULES[type].max > 1) || last}
                      onCheckedChange={(v) => {
                        // A one-number widget swaps its metric instead of refusing a second.
                        const metrics = v
                          ? RULES[type].max === 1
                            ? [m]
                            : [...q.metrics, m]
                          : q.metrics.filter((x) => x !== m);
                        setQ({ metrics, sort: q.limit ? metrics[0]! : "" }); // a "top N" ranks by the first one
                      }}
                    />
                    {ta(`metric.${m}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3 [&>*:only-child]:col-span-2">
            {RULES[type].by.length > 1 && (
              <Field label={t("settings.by")}>
                <NativeSelect
                  value={q.by}
                  onChange={(e) => {
                    const by = e.target.value as AskQuery["by"];
                    setQ({ by, ...(by === "none" || by === "day" ? { sort: "", limit: 0 } : {}) });
                  }}
                >
                  {RULES[type].by.map((b) => (
                    <option key={b} value={b}>
                      {ta(`by.${b}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {["client", "campaign", "owner"].includes(q.by) && (
              <Field label={t("settings.top")}>
                <NativeSelect
                  value={String(q.limit)}
                  onChange={(e) => {
                    const limit = Number(e.target.value);
                    setQ({ limit, sort: limit ? q.metrics[0]! : "" });
                  }}
                >
                  {TOPS.map((n) => (
                    <option key={n} value={n}>
                      {n ? t("settings.topN", { count: n, metric: ta(`metric.${q.metrics[0]}`) }) : t("settings.all")}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>
          {issue === "metrics" && (
            <p role="alert" className="text-danger text-sm">
              {t("settings.metricsInvalid")}
            </p>
          )}
        </>
      )}

      {q && type === "leads" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t("settings.leadFilters")}</legend>
          <div className="flex flex-wrap gap-3">
            {STAGES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={q.filters.stages.includes(s)}
                  onCheckedChange={(v) =>
                    setF({ stages: v ? [...q.filters.stages, s] : q.filters.stages.filter((x) => x !== s) })
                  }
                />
                {ts(s)}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={q.filters.overdue} onCheckedChange={(v) => setF({ overdue: v === true })} />
            {t("settings.overdueOnly")}
          </label>
          <p className="text-muted text-xs">{t("settings.leadsPrivacy")}</p>
        </fieldset>
      )}
      <p className="text-muted text-xs">{t("settings.periodHint")}</p>
    </div>
  );
}
