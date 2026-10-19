"use client";

import { ArrowRight, History, MessageCircleQuestion, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients, useMembers } from "@/shared/lib/lookups";
import { StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type AskAnswer,
  type AskQuery,
  BREAKDOWNS,
  type Breakdown,
  isMoney,
  isRate,
  leadsHref,
  METRICS,
  metricValue,
  PRESETS,
  useAsk,
  useAskHistory,
  useRunQuery,
} from "./api";

const AskChart = dynamic(() => import("./ask-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

const EXAMPLES = ["overdue", "campaign", "agents", "trend"] as const;

export function AskPage() {
  const t = useTranslations("ask");
  const te = useTranslations("errors");
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [question, setQuestion] = useState(initial);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ask = useAsk();
  const run = useRunQuery();
  const asked = useRef<string | null>(null);

  const fail = (e: unknown) =>
    setError(isApiError(e) && te.has(e.code) ? te(e.code) : isApiError(e) ? e.message : t("failed"));
  const submit = (q: string) => {
    const text = q.trim();
    if (text.length < 2) return;
    setError(null);
    router.replace(`/ask?q=${encodeURIComponent(text)}`);
    ask.mutate(text, { onSuccess: setAnswer, onError: fail });
  };
  const edit = (query: AskQuery) => {
    setError(null);
    run.mutate(query, { onSuccess: (a) => setAnswer({ ...a, question: answer?.question }), onError: fail });
  };
  useEffect(() => {
    if (initial && asked.current !== initial) {
      asked.current = initial;
      setQuestion(initial);
      submit(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the URL question changes
  }, [initial]);

  const busy = ask.isPending || run.isPending;
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="text-accent size-6" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted text-sm">{t("subtitle")}</p>
      </header>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("question")}
          maxLength={500}
          className="flex-1"
        />
        <Button type="submit" loading={ask.isPending} disabled={question.trim().length < 2}>
          {t("ask")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {ask.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : answer ? (
        <AnswerView answer={answer} busy={busy} onEdit={edit} />
      ) : (
        <Start onPick={(q) => (setQuestion(q), submit(q))} />
      )}
    </div>
  );
}

function Start({ onPick }: { onPick: (q: string) => void }) {
  const t = useTranslations("ask");
  const history = useAskHistory();
  const recent = history.data?.data ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="grid gap-2 pt-4">
          <h2 className="text-sm font-semibold">{t("tryTitle")}</h2>
          {EXAMPLES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onPick(t(`examples.${k}`))}
              className="border-border hover:bg-surface-2 flex items-center gap-2 rounded-lg border p-2.5 text-start text-sm"
            >
              <MessageCircleQuestion className="text-accent size-4 shrink-0" aria-hidden />
              {t(`examples.${k}`)}
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-2 pt-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" aria-hidden />
            {t("recent")}
          </h2>
          {recent.length === 0 ? (
            <p className="text-muted text-sm">{t("noRecent")}</p>
          ) : (
            recent.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r.question)}
                className="hover:bg-surface-2 rounded-lg px-2 py-1.5 text-start text-sm"
              >
                {r.question}
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Chip({ label, onRemove, removeLabel }: { label: string; onRemove?: () => void; removeLabel: string }) {
  return (
    <span className="bg-primary-soft text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="hover:text-text -me-1 rounded-full p-0.5"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

function AnswerView({ answer, busy, onEdit }: { answer: AskAnswer; busy: boolean; onEdit: (q: AskQuery) => void }) {
  const t = useTranslations("ask");
  const ts = useTranslations("stage");
  const { clients } = useClients();
  const { members } = useMembers();
  const q = answer.query;
  const f = q.filters;
  const set = (patch: Partial<AskQuery>) => onEdit({ ...q, ...patch });
  const setF = (patch: Partial<AskQuery["filters"]>) => onEdit({ ...q, filters: { ...f, ...patch } });
  const label = (id: string) => answer.labels[id] ?? id.slice(0, 8);
  const ownerLabel = (o: string) =>
    o === "me"
      ? t("chips.me")
      : o === "unassigned"
        ? t("chips.unassigned")
        : (members.find((m) => m.user.id === o)?.user.name ?? label(o));

  if (!answer.answerable)
    return (
      <Card>
        <CardContent className="grid gap-2 pt-4">
          <p className="font-medium">{t("notAnswerable")}</p>
          {answer.reason && <p className="text-muted text-sm">{answer.reason}</p>}
          <p className="text-muted text-sm">{t("notAnswerableHint")}</p>
        </CardContent>
      </Card>
    );

  return (
    <div className="grid gap-4" aria-busy={busy}>
      <section aria-label={t("interpreted")} className="grid gap-2">
        <h2 className="text-muted text-xs font-semibold uppercase">{t("interpreted")}</h2>
        <div className="flex flex-wrap items-center gap-2" data-testid="ask-chips">
          <NativeSelect
            className="h-8 w-auto text-xs"
            aria-label={t("chips.kind")}
            value={q.kind}
            onChange={(e) => {
              const kind = e.target.value as AskQuery["kind"];
              onEdit({
                ...q,
                kind,
                metrics: kind === "metrics" ? ["leads"] : [],
                by: kind === "metrics" ? "none" : "",
              });
            }}
          >
            <option value="leads">{t("kind.leads")}</option>
            <option value="metrics">{t("kind.metrics")}</option>
          </NativeSelect>
          {q.kind === "metrics" && (
            <>
              {q.metrics.map((m) => (
                <Chip
                  key={m}
                  label={t(`metric.${m}`)}
                  removeLabel={t("chips.remove", { what: t(`metric.${m}`) })}
                  onRemove={q.metrics.length > 1 ? () => set({ metrics: q.metrics.filter((x) => x !== m) }) : undefined}
                />
              ))}
              <NativeSelect
                className="h-8 w-auto text-xs"
                aria-label={t("chips.addMetric")}
                value=""
                onChange={(e) =>
                  e.target.value && set({ metrics: [...q.metrics, e.target.value as AskQuery["metrics"][number]] })
                }
              >
                <option value="">{t("chips.addMetric")}</option>
                {METRICS.filter((m) => !q.metrics.includes(m)).map((m) => (
                  <option key={m} value={m}>
                    {t(`metric.${m}`)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                className="h-8 w-auto text-xs"
                aria-label={t("chips.by")}
                value={q.by || "none"}
                onChange={(e) => set({ by: e.target.value as AskQuery["by"], sort: "", limit: 0 })}
              >
                {BREAKDOWNS.map((b) => (
                  <option key={b} value={b}>
                    {t(`by.${b}`)}
                  </option>
                ))}
              </NativeSelect>
              {q.sort && (
                <Chip
                  label={
                    q.limit
                      ? t("chips.top", { count: q.limit, metric: t(`metric.${q.sort}`) })
                      : t("chips.sorted", { metric: t(`metric.${q.sort}`) })
                  }
                  removeLabel={t("chips.remove", { what: t("chips.ranking") })}
                  onRemove={() => set({ sort: "", limit: 0 })}
                />
              )}
            </>
          )}
          <NativeSelect
            className="h-8 w-auto text-xs"
            aria-label={t("chips.period")}
            value={q.period.preset}
            onChange={(e) =>
              set({ period: { preset: e.target.value as AskQuery["period"]["preset"], from: "", to: "" } })
            }
          >
            {q.kind === "leads" && <option value="">{t("period.all")}</option>}
            {q.period.preset === "custom" && <option value="custom">{t("period.custom")}</option>}
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {t(`period.${p}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="h-8 w-auto text-xs"
            aria-label={t("chips.client")}
            value={f.client_id}
            onChange={(e) => setF({ client_id: e.target.value })}
          >
            <option value="">{t("chips.allClients")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          {f.campaign_id && (
            <Chip
              label={t("chips.campaign", { name: label(f.campaign_id) })}
              removeLabel={t("chips.remove", { what: label(f.campaign_id) })}
              onRemove={() => setF({ campaign_id: "" })}
            />
          )}
          {f.owner && (
            <Chip
              label={t("chips.owner", { name: ownerLabel(f.owner) })}
              removeLabel={t("chips.remove", { what: ownerLabel(f.owner) })}
              onRemove={() => setF({ owner: "" })}
            />
          )}
          {f.stages.map((s) => (
            <Chip
              key={s}
              label={ts(s)}
              removeLabel={t("chips.remove", { what: ts(s) })}
              onRemove={() => setF({ stages: f.stages.filter((x) => x !== s) })}
            />
          ))}
          {f.overdue && (
            <Chip
              label={t("chips.overdue")}
              removeLabel={t("chips.remove", { what: t("chips.overdue") })}
              onRemove={() => setF({ overdue: false })}
            />
          )}
          {f.quality && (
            <Chip
              label={t(`chips.quality.${f.quality}`)}
              removeLabel={t("chips.remove", { what: t(`chips.quality.${f.quality}`) })}
              onRemove={() => setF({ quality: "" })}
            />
          )}
        </div>
        {answer.notes.length > 0 && (
          <ul className="text-muted grid gap-0.5 text-xs">
            {answer.notes.map((n) => (
              <li key={n}>
                {n.startsWith("filter_ignored:")
                  ? t("notes.ignored", { filter: t(`notes.filter.${n.slice(15)}`) })
                  : t(`notes.${n}`)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {answer.leads && <LeadsAnswer answer={answer} />}
      {answer.metrics && <MetricsAnswer answer={answer} />}
    </div>
  );
}

function LeadsAnswer({ answer }: { answer: AskAnswer }) {
  const t = useTranslations("ask");
  const f = useFormat();
  const { byId } = useClients();
  const r = answer.leads!;
  return (
    <Card>
      <CardContent className="grid gap-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-semibold" data-testid="ask-count">
            {t("leadsCount", { count: r.count })}
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href={leadsHref(answer)}>
              {t("openLeads")}
              <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        {r.preview.length === 0 ? (
          <EmptyState title={t("noLeads")} />
        ) : (
          <ul className="grid gap-1.5">
            {r.preview.map((l) => {
              const tz = byId.get(l.client_id)?.timezone ?? "UTC";
              return (
                <li
                  key={l.id}
                  className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <Link href={`/leads/${l.id}`} className="text-primary font-medium hover:underline">
                    {l.full_name || l.phone?.display || "—"}
                  </Link>
                  <span className="text-muted">{byId.get(l.client_id)?.name}</span>
                  <StageBadge stage={l.stage} />
                  <span className="text-muted ms-auto text-xs">{f.dateTime(l.received_at, tz, "short")}</span>
                </li>
              );
            })}
          </ul>
        )}
        {r.count > r.preview.length && (
          <p className="text-muted text-xs">{t("more", { count: r.count - r.preview.length })}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricsAnswer({ answer }: { answer: AskAnswer }) {
  const t = useTranslations("ask");
  const f = useFormat();
  const m = answer.metrics!;
  const metrics = answer.query.metrics;
  const fmtValue = (v: number | null, k: string) => {
    if (v == null) return "—";
    if (isRate(k)) return f.percent(v);
    if (isMoney(k)) return m.currency ? f.money({ amount_minor: v, currency: m.currency }) : "—";
    return f.number(v);
  };
  const fmt = (b: Breakdown, k: string) => fmtValue(metricValue(b, k), k);
  const rowName = (b: Breakdown) =>
    answer.query.by === "day"
      ? (b.day ?? "")
      : b.name || (answer.query.by === "owner" ? t("chips.unassigned") : t("none"));
  const by = answer.query.by;
  return (
    <Card>
      <CardContent className="grid gap-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="ask-totals">
          {metrics.map((k) => (
            <div key={k} className="grid gap-0.5">
              <span className="text-muted text-xs">{t(`metric.${k}`)}</span>
              <span className="text-xl font-semibold tabular-nums">{fmt(m.total, k)}</span>
            </div>
          ))}
        </div>
        {answer.period && (
          <p className="text-muted text-xs">
            {t("periodLine", { from: answer.period.from, to: answer.period.to, zone: answer.period.timezone })}
          </p>
        )}
        {by !== "none" && m.rows.length > 0 && (
          <>
            <AskChart
              rows={m.rows.map((b) => ({ name: rowName(b), value: metricValue(b, metrics[0]!) ?? 0 }))}
              line={by === "day"}
              label={t(`metric.${metrics[0]}`)}
              format={(v) => fmtValue(v, metrics[0]!)}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("table", { by: t(`by.${by}`) })}</caption>
                <thead className="text-muted text-xs">
                  <tr className="border-border border-b">
                    <th scope="col" className="p-2 text-start font-medium">
                      {t(`by.${by}`)}
                    </th>
                    {metrics.map((k) => (
                      <th key={k} scope="col" className="p-2 text-end font-medium">
                        {t(`metric.${k}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.rows.map((b, i) => (
                    <tr key={(b.id ?? b.day ?? "") + i} className="border-border border-b last:border-0">
                      <th scope="row" className="p-2 text-start font-medium">
                        {rowName(b)}
                      </th>
                      {metrics.map((k) => (
                        <td key={k} className="p-2 text-end tabular-nums">
                          {fmt(b, k)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
