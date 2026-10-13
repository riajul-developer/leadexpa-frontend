"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type AttributionModel, MODELS, useAttribution } from "./api";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Multi-touch attribution with a model switcher; the model is labelled on every number (17.11). */
export function AttributionPanel({ clientId }: { clientId?: string }) {
  const t = useTranslations("insights.attribution");
  const tk = useTranslations("source");
  const f = useFormat();
  const [model, setModel] = useState<AttributionModel>("linear");
  const [to, setTo] = useState(() => iso(new Date()));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const query = useMemo(
    () => ({ model, from, to, ...(clientId ? { client_id: clientId } : {}) }),
    [model, from, to, clientId],
  );
  const q = useAttribution(query);
  const label = t(`model.${model}`);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <Badge tone="primary" data-model-label>
          {t("label", { model: label })}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("modelPick")}>
            <NativeSelect value={model} onChange={(e) => setModel(e.target.value as AttributionModel)}>
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {t(`model.${m}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("from")}>
            <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </Field>
          <Field label={t("to")}>
            <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </Field>
        </div>
        <p className="text-muted text-xs">{t(`note.${model}`)}</p>
        {!q.data ? (
          <Skeleton className="h-40 w-full" />
        ) : q.data.rows.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted">
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("col.channel")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("col.leads")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("col.won")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("col.revenue", { model: label })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((r) => (
                  <tr key={r.key} className="border-border border-t tabular-nums" data-row={r.name}>
                    <th scope="row" className="py-2 text-start font-normal">
                      {r.kind === "campaign" ? r.name || t("unnamed") : tk.has(r.name) ? tk(r.name) : r.name}
                      {r.kind === "source" && <span className="text-muted text-xs"> · {t("noCampaign")}</span>}
                    </th>
                    <td className="text-end">{f.number(r.leads, { maximumFractionDigits: 1 })}</td>
                    <td className="text-end">{f.number(r.won, { maximumFractionDigits: 1 })}</td>
                    <td className="text-end">
                      {r.revenue.length === 0 ? "—" : r.revenue.map((m) => f.money(m)).join(" + ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
