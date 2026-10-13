"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Progress, Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

const KEY = ["scoring"] as const;

type Metrics = { auc?: number; baseline_auc?: number; brier?: number; baseline_brier?: number; n?: number } | null;

/** Settings › Lead scoring (17.7): which model scores leads, how good it is, and what drives it. */
export function ScoringSettings() {
  const t = useTranslations("scoringSettings");
  const tf = useTranslations("score.feature");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const qc = useQueryClient();
  const canManage = useCan("agency.update");
  const model = useQuery({ queryKey: KEY, queryFn: () => unwrap(api.GET("/v1/scoring")) });
  const optIn = useMutation({
    mutationFn: (pool_opt_in: boolean) => unwrap(api.PUT("/v1/scoring/settings", { body: { pool_opt_in } })),
    onSuccess: (m) => qc.setQueryData(KEY, m),
  });
  const train = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/scoring/train")),
    onSuccess: (r) => {
      track("scoring.trained", { trained: r.trained });
      void qc.invalidateQueries({ queryKey: KEY });
      if (r.trained) toast.success(t("trained"));
      else toast.info(t(`notTrained.${r.reason}`, { labeled: f.number(r.labeled) }));
    },
  });
  const m = model.data;
  if (!m) return <Skeleton className="h-64 w-full" />;
  const metrics = m.metrics as Metrics;
  const weights = [...m.weights].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const maxW = Math.max(...weights.map((w) => Math.abs(w.weight)), 1);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="text-accent size-5" aria-hidden />
            {t("title")}
          </CardTitle>
          <Badge tone={m.source === "rules" ? "neutral" : "success"}>{t(`source.${m.source}`)}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-muted text-sm">{t(`sourceHint.${m.source}`)}</p>
          {m.status === "drift" && (
            <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-lg p-3 text-sm" role="status">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("drift")}
            </p>
          )}
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted text-xs">{t("version")}</dt>
              <dd className="font-medium" dir="ltr">
                {m.version}
              </dd>
            </div>
            {m.trained_at && (
              <div>
                <dt className="text-muted text-xs">{t("trainedAt")}</dt>
                <dd>{f.dateTime(m.trained_at, tz, "date")}</dd>
              </div>
            )}
            {metrics?.auc !== undefined && (
              <div>
                <dt className="text-muted text-xs">{t("accuracy")}</dt>
                <dd>
                  {t("auc", {
                    auc: f.number(metrics.auc, { maximumFractionDigits: 2 }),
                    rules: f.number(metrics.baseline_auc ?? 0, { maximumFractionDigits: 2 }),
                  })}
                </dd>
              </div>
            )}
          </dl>
          <div className="grid gap-1">
            <div className="flex justify-between text-sm">
              <span>{t("labeled")}</span>
              <span className="text-muted tabular-nums">
                {f.number(m.labeled)} / {f.number(m.min_labels)}
              </span>
            </div>
            <Progress value={Math.min(100, (m.labeled / Math.max(m.min_labels, 1)) * 100)} label={t("labeled")} />
            <p className="text-muted text-xs">{t("labeledHint", { min: f.number(m.min_labels) })}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={m.pool_opt_in} onCheckedChange={(v) => optIn.mutate(v)} disabled={optIn.isPending} />
                {t("pool")}
              </label>
              <Button variant="secondary" loading={train.isPending} onClick={() => train.mutate()}>
                {t("train")}
              </Button>
            </div>
          )}
          {canManage && <p className="text-muted text-xs">{t("poolHint")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("drivers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {weights.map((w) => (
              <li
                key={w.feature}
                className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm"
                data-feature={w.feature}
              >
                <span>{tf.has(w.feature) ? tf(w.feature) : w.feature}</span>
                <span className="bg-surface-2 relative h-2 overflow-hidden rounded-full" aria-hidden>
                  <span
                    className={
                      w.weight >= 0 ? "bg-success absolute inset-y-0 start-1/2" : "bg-danger absolute inset-y-0 end-1/2"
                    }
                    style={{ width: `${(Math.abs(w.weight) / maxW) * 50}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-3 text-xs">
            {t("feedback", { high: m.feedback_too_high, low: m.feedback_too_low })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
