"use client";

import { BookOpen, FlaskConical, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, Textarea } from "@/shared/ui/input";
import { Dialog, DialogContent, Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type Agent,
  type AgentInput,
  CHANNELS,
  type EvalRun,
  TRIGGERS,
  useAddKnowledge,
  useAgent,
  useDeleteKnowledge,
  useKnowledge,
  useRunEval,
  useSaveAgent,
  useSearchKnowledge,
  useSetAutonomy,
} from "./api";

export function AgentSettings({ clientId }: { clientId: string }) {
  const agent = useAgent(clientId);
  if (!agent.data) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="grid gap-4">
      <AutonomyCard clientId={clientId} agent={agent.data} />
      <EvalsCard clientId={clientId} agent={agent.data} />
      <GuardrailsCard clientId={clientId} agent={agent.data} />
      <KnowledgeCard clientId={clientId} />
    </div>
  );
}

function AutonomyCard({ clientId, agent }: { clientId: string; agent: Agent }) {
  const t = useTranslations("agent.autonomy");
  const te = useTranslations("errors");
  const set = useSetAutonomy(clientId);
  const isOwner = useCan("billing.manage");
  const [confirm, setConfirm] = useState<number | null>(null);
  const choose = (level: number) => {
    if (level === agent.autonomy) return;
    if (level > 1) setConfirm(level);
    else apply(level);
  };
  const apply = (level: number) =>
    set.mutate(level, {
      onSuccess: () => {
        toast.success(t("changed", { level: t(`level.${level}.name`) }));
        setConfirm(null);
      },
      onError: (e) => {
        toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : isApiError(e) ? e.message : t("failed"));
        setConfirm(null);
      },
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        {agent.killed && <Badge tone="danger">{t("killed")}</Badge>}
      </CardHeader>
      <CardContent className="grid gap-3">
        <div role="radiogroup" aria-label={t("title")} className="grid gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={agent.autonomy === l}
              data-level={l}
              disabled={set.isPending}
              onClick={() => choose(l)}
              className={cn(
                "border-border grid gap-1 rounded-xl border p-3 text-start transition",
                agent.autonomy === l ? "border-primary bg-primary-soft" : "hover:bg-surface-2",
              )}
            >
              <span className="text-sm font-semibold">
                L{l} · {t(`level.${l}.name`)}
              </span>
              <span className="text-muted text-xs">{t(`level.${l}.does`)}</span>
            </button>
          ))}
        </div>
        <p className="text-muted text-xs">{isOwner ? t("gate") : t("ownerOnly")}</p>
      </CardContent>
      {confirm != null && (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent
            title={t("confirmTitle", { level: t(`level.${confirm}.name`) })}
            description={t(`level.${confirm}.consequence`)}
          >
            <ul className="text-muted grid list-disc gap-1 ps-5 text-sm">
              <li>{t("confirm.disclose")}</li>
              <li>{t("confirm.handoff")}</li>
              <li>{t("confirm.kill")}</li>
            </ul>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                {t("cancel")}
              </Button>
              <Button loading={set.isPending} onClick={() => apply(confirm)}>
                {t("confirmButton")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function EvalsCard({ clientId, agent }: { clientId: string; agent: Agent }) {
  const t = useTranslations("agent.evals");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const run = useRunEval(clientId);
  const [last, setLast] = useState<EvalRun | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted text-sm">{t("hint")}</p>
        <ul className="grid gap-2">
          {agent.languages.map((l) => {
            const e = agent.evals.find((x) => x.language === l);
            return (
              <li
                key={l}
                className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
                data-eval={l}
              >
                <Badge>{l.toUpperCase()}</Badge>
                <span className="min-w-0 flex-1 text-sm">
                  {!e
                    ? t("never")
                    : e.valid
                      ? t("passed", { score: f.percent(e.score), when: f.dateTime(e.ran_at, tz, "date") })
                      : e.passed
                        ? t("expired")
                        : t("failedRun", { score: f.percent(e.score) })}
                </span>
                {e?.valid && <ShieldCheck className="text-success size-5" aria-label={t("valid")} />}
                <Button
                  size="sm"
                  variant="secondary"
                  loading={run.isPending && run.variables === l}
                  onClick={() => run.mutate(l, { onSuccess: (r) => setLast(r) })}
                >
                  {t("run")}
                </Button>
              </li>
            );
          })}
        </ul>
        {last && (
          <div className="grid gap-1 text-sm" aria-live="polite">
            <p className="font-medium">
              {last.passed
                ? t("runPassed", { language: last.language.toUpperCase() })
                : t("runFailed", { language: last.language.toUpperCase() })}
            </p>
            <ul className="grid gap-1">
              {last.results.map((r) => (
                <li key={r.case} className="flex gap-2" data-case={r.case}>
                  <span className={r.passed ? "text-success" : "text-danger"}>{r.passed ? "✓" : "✗"}</span>
                  <span>{t.has(`case.${r.case}`) ? t(`case.${r.case}`) : r.case}</span>
                  {!r.passed && r.why && <span className="text-muted">— {r.why}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const toInput = (a: Agent): AgentInput => ({
  channels: a.channels,
  languages: a.languages,
  goals: a.goals,
  policy: a.policy,
  qualification: a.qualification,
  handoff_triggers: a.handoff_triggers,
  min_confidence: a.min_confidence,
  max_turns: a.max_turns,
  max_cost_micros: a.max_cost_micros,
  daily_cost_micros: a.daily_cost_micros,
  hours_start: a.hours_start,
  hours_end: a.hours_end,
});

function GuardrailsCard({ clientId, agent }: { clientId: string; agent: Agent }) {
  const t = useTranslations("agent.guardrails");
  const tt = useTranslations("agent.reason");
  const save = useSaveAgent(clientId);
  const [d, setD] = useState<AgentInput>(() => toInput(agent));
  useEffect(() => setD(toInput(agent)), [agent]);
  const toggle = <K extends "channels" | "handoff_triggers">(k: K, v: string, on: boolean) =>
    setD({ ...d, [k]: on ? [...d[k], v] : d[k].filter((x) => x !== v) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(d, { onSuccess: () => toast.success(t("saved")) });
          }}
        >
          <Field label={t("languages")} hint={t("languagesHint")}>
            <Input
              dir="ltr"
              value={d.languages.join(", ")}
              onChange={(e) =>
                setD({
                  ...d,
                  languages: e.target.value
                    .split(",")
                    .map((x) => x.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">{t("channels")}</legend>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <Switch checked={d.channels.includes(c)} onCheckedChange={(on) => toggle("channels", c, on)} />
                  {t(`channel.${c}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t("goals")} className="sm:col-span-2">
            <Textarea rows={2} value={d.goals} onChange={(e) => setD({ ...d, goals: e.target.value })} />
          </Field>
          <Field label={t("policy")} hint={t("policyHint")} className="sm:col-span-2">
            <Textarea rows={3} value={d.policy} onChange={(e) => setD({ ...d, policy: e.target.value })} />
          </Field>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="text-sm font-medium">{t("qualification")}</legend>
            {d.qualification.map((q, i) => (
              <div key={i} className="grid grid-cols-[8rem_1fr_auto] gap-2">
                <Input
                  aria-label={t("key")}
                  value={q.key}
                  dir="ltr"
                  onChange={(e) =>
                    setD({
                      ...d,
                      qualification: d.qualification.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
                    })
                  }
                />
                <Input
                  aria-label={t("question")}
                  value={q.question}
                  onChange={(e) =>
                    setD({
                      ...d,
                      qualification: d.qualification.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("removeStep")}
                  onClick={() => setD({ ...d, qualification: d.qualification.filter((_, j) => j !== i) })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="justify-self-start"
              disabled={d.qualification.length >= 10}
              onClick={() => setD({ ...d, qualification: [...d.qualification, { key: "", question: "" }] })}
            >
              <Plus aria-hidden />
              {t("addStep")}
            </Button>
          </fieldset>
          <fieldset className="grid gap-1.5 sm:col-span-2">
            <legend className="text-sm font-medium">{t("triggers")}</legend>
            <div className="flex flex-wrap gap-3">
              {TRIGGERS.map((x) => (
                <label key={x} className="flex items-center gap-1.5 text-sm">
                  <Switch
                    checked={d.handoff_triggers.includes(x)}
                    onCheckedChange={(on) => toggle("handoff_triggers", x, on)}
                  />
                  {tt(x)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t("confidence")} hint={t("confidenceHint")}>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={d.min_confidence}
              onChange={(e) => setD({ ...d, min_confidence: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("maxTurns")}>
            <Input
              type="number"
              min={1}
              max={50}
              value={d.max_turns}
              onChange={(e) => setD({ ...d, max_turns: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("convCap")} hint={t("capHint")}>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={d.max_cost_micros / 1_000_000}
              onChange={(e) =>
                setD({ ...d, max_cost_micros: Math.max(1, Math.round(Number(e.target.value) * 1_000_000)) })
              }
            />
          </Field>
          <Field label={t("dailyCap")} hint={t("capHint")}>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={d.daily_cost_micros / 1_000_000}
              onChange={(e) =>
                setD({ ...d, daily_cost_micros: Math.max(1, Math.round(Number(e.target.value) * 1_000_000)) })
              }
            />
          </Field>
          <Field label={t("hours")} hint={t("hoursHint")}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                aria-label={t("hoursStart")}
                value={d.hours_start}
                onChange={(e) => setD({ ...d, hours_start: Number(e.target.value) })}
              />
              <span aria-hidden>–</span>
              <Input
                type="number"
                min={1}
                max={24}
                aria-label={t("hoursEnd")}
                value={d.hours_end}
                onChange={(e) => setD({ ...d, hours_end: Number(e.target.value) })}
              />
            </div>
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function KnowledgeCard({ clientId }: { clientId: string }) {
  const t = useTranslations("agent.kb");
  const f = useFormat();
  const docs = useKnowledge(clientId);
  const remove = useDeleteKnowledge(clientId);
  const search = useSearchKnowledge(clientId);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        {!docs.data ? (
          <Skeleton className="h-20 w-full" />
        ) : docs.data.data.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <ul className="divide-border grid divide-y">
            {docs.data.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm" data-doc={d.title}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" dir="auto">
                    {d.title}
                  </span>
                  <span className="text-muted text-xs">
                    {t("size", { chars: f.number(d.chars), chunks: d.chunks })}
                    {d.source_url && ` · ${d.source_url}`}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("remove", { title: d.title })}
                  onClick={() => remove.mutate(d.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) search.mutate(q);
          }}
        >
          <div className="flex items-end gap-2">
            <Field label={t("test")} hint={t("testHint")} className="flex-1">
              <Input value={q} dir="auto" onChange={(e) => setQ(e.target.value)} />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              loading={search.isPending}
              aria-label={t("search")}
              className="mb-5"
            >
              <Search aria-hidden />
            </Button>
          </div>
          {search.data &&
            (search.data.data.length === 0 ? (
              <p className="text-warning text-sm">{t("noMatch")}</p>
            ) : (
              <ol className="grid gap-1.5 text-sm">
                {search.data.data.map((p, i) => (
                  <li key={p.id} className="bg-surface-2 rounded-lg p-2" dir="auto">
                    <span className="text-muted text-xs">
                      [{i + 1}] {p.title}
                    </span>
                    <p>{p.text}</p>
                  </li>
                ))}
              </ol>
            ))}
        </form>
      </CardContent>
      {adding && <AddDocumentDialog clientId={clientId} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddDocumentDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const t = useTranslations("agent.kb");
  const te = useTranslations("errors");
  const add = useAddKnowledge(clientId);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("add")} description={t("addHint")}>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(
              { title: title || undefined, text: text || undefined, url: url || undefined },
              {
                onSuccess: () => {
                  toast.success(t("added"));
                  onClose();
                },
              },
            );
          }}
        >
          <Field label={t("docTitle")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t("text")}>
            <Textarea rows={8} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field label={t("url")} hint={t("urlHint")}>
            <Input type="url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          {add.isError && (
            <p className="text-danger text-sm" role="alert">
              {isApiError(add.error) && te.has(add.error.code) ? te(add.error.code) : t("failed")}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!text.trim() && !url.trim()} loading={add.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
