"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Lock, Medal, Sprout, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, Skeleton } from "@/shared/ui/primitives";

type View = Schemas["CoachingView"];
type Week = Schemas["CoachingWeek"];

const key = ["me", "coaching"] as const;

function useCoaching() {
  return useQuery({ queryKey: key, queryFn: () => unwrap(api.GET("/v1/me/coaching")) });
}

function useSetCoaching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => unwrap(api.PUT("/v1/me/coaching", { body: { enabled } })),
    onSuccess: (v) => {
      track(v.enabled ? "coaching.enabled" : "coaching.disabled");
      qc.setQueryData(key, v);
    },
  });
}

/**
 * /progress: opt-in personal coaching (Tier 3, 8h). Streaks and personal bests compare you only with yourself;
 * nobody else sees this page. Coaching tone: what went well and what's next, never a ranking.
 */
export function ProgressPage() {
  const t = useTranslations("coaching");
  const q = useCoaching();
  const set = useSetCoaching();
  const v = q.data;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sprout className="text-success size-6" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted text-sm">{t("subtitle")}</p>
      </header>
      {q.isPending || !v ? (
        <Skeleton className="h-64" />
      ) : !v.enabled || !v.summary ? (
        <Card>
          <CardContent className="grid gap-3 pt-5">
            <h2 className="text-lg font-semibold">{t("optIn.title")}</h2>
            <ul className="text-muted grid list-disc gap-1 ps-5 text-sm">
              <li>{t("optIn.private")}</li>
              <li>{t("optIn.self")}</li>
              <li>{t("optIn.board")}</li>
            </ul>
            <Button className="justify-self-start" loading={set.isPending} onClick={() => set.mutate(true)}>
              {t("optIn.turnOn")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Summary view={v} onOff={() => set.mutate(false)} busy={set.isPending} />
      )}
    </div>
  );
}

function Summary({ view, onOff, busy }: { view: View; onOff: () => void; busy: boolean }) {
  const t = useTranslations("coaching");
  const f = useFormat();
  const s = view.summary!;
  const dur = (sec: number | null | undefined) => (sec == null ? "—" : f.duration(Math.round(sec)));
  const weekOf = (w: Week) => f.dateTime(w.start.slice(0, 10) + "T12:00:00Z", "UTC", "date");
  const faster =
    s.this_week.median_seconds != null && s.last_week.median_seconds != null
      ? s.this_week.median_seconds < s.last_week.median_seconds
      : null;
  const maxAnswered = Math.max(1, ...s.weeks.map((w) => w.answered));

  return (
    <div className="grid gap-4">
      <p
        role="status"
        className="bg-success-soft text-success rounded-xl px-4 py-3 text-sm font-medium"
        data-testid="coaching-highlight"
      >
        {t(`highlights.${s.highlights[0] ?? "keep_going"}`, { days: s.streak.current })}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="grid gap-1 pt-4">
            <span className="text-muted flex items-center gap-1.5 text-xs">
              <Flame aria-hidden className="text-warning size-4" />
              {t("streak")}
            </span>
            <span className="text-3xl font-semibold tabular-nums" data-testid="coaching-streak">
              {t("days", { count: s.streak.current })}
            </span>
            <span className="text-muted text-xs">{t("bestStreak", { count: s.streak.best })}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 pt-4">
            <span className="text-muted text-xs">{t("thisWeek")}</span>
            <span className="text-3xl font-semibold tabular-nums">{dur(s.this_week.median_seconds)}</span>
            <span className="text-muted flex items-center gap-1 text-xs">
              {faster === true && <TrendingDown aria-hidden className="text-success size-3.5" />}
              {faster === false && <TrendingUp aria-hidden className="size-3.5" />}
              {t("answeredOnTime", {
                answered: s.this_week.answered,
                rate: f.percent(s.this_week.on_time_rate ?? null),
              })}
            </span>
            <span className="text-muted text-xs">{t("lastWeek", { time: dur(s.last_week.median_seconds) })}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 pt-4">
            <span className="text-muted flex items-center gap-1.5 text-xs">
              <Medal aria-hidden className="text-accent size-4" />
              {t("personalBest")}
            </span>
            <span className="text-3xl font-semibold tabular-nums">{dur(s.best?.median_seconds)}</span>
            <span className="text-muted text-xs">{s.best ? t("bestWeek", { week: weekOf(s.best) }) : t("noBest")}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-4">
          <h2 className="text-sm font-semibold">{t("weeks")}</h2>
          {s.weeks.length === 0 ? (
            <p className="text-muted text-sm">{t("noWeeks")}</p>
          ) : (
            <ol className="flex h-32 items-end gap-1.5" aria-label={t("weeks")}>
              {s.weeks.map((w) => (
                <li key={w.start} className="flex h-full flex-1 flex-col justify-end gap-1">
                  <span
                    className={`rounded-t ${s.best?.start === w.start ? "bg-accent" : "bg-primary/60"}`}
                    style={{ height: `${Math.max(4, (w.answered / maxAnswered) * 100)}%` }}
                    title={`${weekOf(w)}: ${t("answeredOnTime", { answered: w.answered, rate: f.percent(w.on_time_rate ?? null) })}`}
                  />
                  <span className="sr-only">
                    {weekOf(w)}:{" "}
                    {t("answeredOnTime", { answered: w.answered, rate: f.percent(w.on_time_rate ?? null) })}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-muted text-xs">{t("weeksHint")}</p>
        </CardContent>
      </Card>

      <p className="text-muted flex flex-wrap items-center gap-2 text-xs">
        <Lock aria-hidden className="size-3.5" />
        {t("privateNote")}
        <Button variant="link" size="sm" className="text-xs" onClick={onOff} disabled={busy}>
          {t("turnOff")}
        </Button>
      </p>
    </div>
  );
}
