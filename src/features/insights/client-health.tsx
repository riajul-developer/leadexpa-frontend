"use client";

import { Copy, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, Textarea } from "@/shared/ui/input";
import { Dialog, DialogContent, Progress } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type ClientHealth as Health, useClientHealth, useDraftUpdate, useRefreshHealth } from "./api";
import { HealthRing, TrendLine, useAnomalyText } from "./health-parts";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", bn: "Bangla", ar: "Arabic" };

export function ClientHealth({
  clientId,
  clientName,
  currency,
}: {
  clientId: string;
  clientName: string;
  currency: string;
}) {
  const t = useTranslations("insights.health");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const health = useClientHealth(clientId);
  const refresh = useRefreshHealth(clientId);
  const anomalyText = useAnomalyText();
  const [drafting, setDrafting] = useState(false);
  const h = health.data;
  if (!h) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" loading={refresh.isPending} onClick={() => refresh.mutate()}>
              {!refresh.isPending && <RefreshCw aria-hidden />}
              {t("refresh")}
            </Button>
            <Button size="sm" onClick={() => setDrafting(true)} disabled={h.score == null}>
              <Sparkles aria-hidden />
              {t("draft")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <HealthRing score={h.score} band={h.band} size={120} />
          {h.components.length === 0 ? (
            <p className="text-muted text-sm">{t("noScoreHint")}</p>
          ) : (
            <ul className="grid gap-3">
              {h.components.map((c) => (
                <li key={c.key} className="grid gap-1" data-component={c.key}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{t(`component.${c.key}`)}</span>
                    <span className="text-muted tabular-nums">{componentDetail(t, f, c, currency)}</span>
                  </div>
                  <Progress
                    value={c.score}
                    tone={c.score >= 70 ? "primary" : c.score >= 40 ? "warning" : "danger"}
                    label={t(`component.${c.key}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {h.trend.length > 1 && (
          <CardContent>
            <Sparkline points={h.trend.map((p) => p.score)} label={t("trend")} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("anomalies")}</CardTitle>
        </CardHeader>
        <CardContent>
          {h.anomalies.length === 0 ? (
            <EmptyState title={t("noAnomalies")} />
          ) : (
            <ol className="border-border grid gap-3 border-s-2 ps-4">
              {h.anomalies.map((a) => (
                <li key={`${a.metric}-${a.day}`} className="relative text-sm" data-anomaly={a.metric}>
                  <span
                    aria-hidden
                    className={`absolute -start-[1.4rem] top-1 size-2.5 rounded-full ${a.adverse ? "bg-danger" : "bg-success"}`}
                  />
                  <p className="flex items-start gap-1.5">
                    {a.direction === "down" ? (
                      <TrendingDown
                        className={`mt-0.5 size-4 shrink-0 ${a.adverse ? "text-danger" : "text-success"}`}
                        aria-hidden
                      />
                    ) : (
                      <TrendingUp
                        className={`mt-0.5 size-4 shrink-0 ${a.adverse ? "text-danger" : "text-success"}`}
                        aria-hidden
                      />
                    )}
                    {anomalyText(a, tz)}
                  </p>
                  <p className="text-muted text-xs">
                    {t("anomalyDetail", { z: f.number(Math.abs(a.z), { maximumFractionDigits: 1 }) })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      {drafting && <DraftDialog clientId={clientId} clientName={clientName} onClose={() => setDrafting(false)} />}
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;
function componentDetail(t: T, f: ReturnType<typeof useFormat>, c: Health["components"][number], currency: string) {
  const pct = (v: number | null) => (v == null ? "—" : f.percent(v));
  switch (c.key) {
    case "volume":
      return c.value == null ? `${c.score}` : t("vsUsual", { now: pct(c.value), usual: "100%" });
    case "speed":
      return t("onTime", { pct: pct(c.value) });
    case "contact":
    case "conversion":
      return t("vsUsual", { now: pct(c.value), usual: pct(c.baseline) });
    case "cost":
      return t("costVs", {
        now: f.money({ amount_minor: Math.round(c.value ?? 0), currency }),
        usual: f.money({ amount_minor: Math.round(c.baseline ?? 0), currency }),
      });
    case "stability":
      return t("anomalyCount", { count: c.value ?? 0 });
    default:
      return `${c.score}`;
  }
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  return (
    <figure className="grid gap-1">
      <TrendLine points={points} label={label} />
      <figcaption className="text-muted text-xs">{label}</figcaption>
    </figure>
  );
}

function DraftDialog({ clientId, clientName, onClose }: { clientId: string; clientName: string; onClose: () => void }) {
  const t = useTranslations("insights.draft");
  const te = useTranslations("errors");
  const locale = useLocale();
  const draft = useDraftUpdate(clientId);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [started, setStarted] = useState(false);
  if (!started) {
    setStarted(true);
    draft.mutate(LANGUAGE_NAMES[locale] ?? "English", {
      onSuccess: (d) => {
        setSubject(d.subject);
        setBody(d.body);
      },
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("title", { client: clientName })} description={t("hint")}>
        {draft.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : draft.isError ? (
          <p className="text-danger text-sm" role="alert">
            {isApiError(draft.error) && te.has(draft.error.code) ? te(draft.error.code) : t("failed")}
          </p>
        ) : (
          <div className="grid gap-3">
            <Field label={t("subject")}>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label={t("body")}>
              <Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose}>
                {t("close")}
              </Button>
              <Button
                onClick={() =>
                  void navigator.clipboard.writeText(`${subject}\n\n${body}`).then(() => toast.success(t("copied")))
                }
              >
                <Copy aria-hidden />
                {t("copy")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
