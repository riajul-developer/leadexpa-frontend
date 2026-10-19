"use client";

import { ArrowDown, ArrowUp, Bot, Clock, MessageCircle, MessageSquare, PhoneCall, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives";

import {
  useApprovedTemplates,
  usePreview,
  useSaveSequence,
  type ExitCondition,
  type Sequence,
  type SequenceInput,
  type Step,
  type StepType,
  type Trigger,
} from "./api";

const KINDS = ["no_answer", "stale", "lost", "manual"] as const;
const STALE_STAGES = ["new", "contacted", "qualified"] as const;
const LOST_REASONS = ["price", "no_response", "not_interested", "bought_elsewhere", "other"] as const;
const EXITS: ExitCondition[] = ["reply", "stage_changed", "sale", "opt_out"];
const STEP_TYPES: StepType[] = ["wait", "whatsapp_template", "sms", "call_task", "ai_draft"];
const STEP_ICON = {
  wait: Clock,
  whatsapp_template: MessageCircle,
  sms: MessageSquare,
  call_task: PhoneCall,
  ai_draft: Bot,
};

const BLANK: SequenceInput = {
  name: "",
  client_id: null,
  trigger: { kind: "no_answer", attempts: 2 },
  steps: [{ type: "whatsapp_template" }, { type: "wait", hours: 48 }, { type: "call_task", note: "" }],
  exit_on: EXITS,
  holdout_percent: 10,
};

function triggerFor(kind: Trigger["kind"], prev: Trigger): Trigger {
  switch (kind) {
    case "no_answer":
      return { kind, attempts: prev.attempts ?? 2 };
    case "stale":
      return { kind, stages: prev.stages?.length ? prev.stages : ["contacted"], days: prev.days || 7 };
    case "lost":
      return { kind, reasons: prev.reasons?.length ? prev.reasons : ["price", "no_response"], days: prev.days ?? 14 };
    default:
      return { kind };
  }
}

export function SequenceEditor({ sequence, defaultClient }: { sequence?: Sequence; defaultClient?: string }) {
  const t = useTranslations("sequences");
  const te = useTranslations("errors");
  const router = useRouter();
  const { data: me } = useMe();
  const { clients } = useClients();
  const allowAll = me?.membership?.role === "owner" || me?.membership?.role === "admin";
  const [v, setV] = useState<SequenceInput>(() =>
    sequence
      ? {
          name: sequence.name,
          client_id: sequence.client_id,
          trigger: sequence.trigger,
          steps: sequence.steps,
          exit_on: sequence.exit_on,
          holdout_percent: sequence.holdout_percent,
        }
      : { ...BLANK, client_id: defaultClient ?? clients[0]?.id ?? null },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientTouched, setClientTouched] = useState(false);
  const firstClient = clients[0]?.id;
  useEffect(() => {
    if (!sequence && !clientTouched && firstClient) setV((x) => (x.client_id ? x : { ...x, client_id: firstClient }));
  }, [sequence, clientTouched, firstClient]);
  const save = useSaveSequence(sequence?.id ?? null);
  const set = (patch: Partial<SequenceInput>) => setV((x) => ({ ...x, ...patch }));
  const setStep = (i: number, patch: Partial<Step>) =>
    set({ steps: v.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const steps = [...v.steps];
    [steps[i], steps[i + d]] = [steps[i + d]!, steps[i]!];
    set({ steps });
  };
  const exits = v.exit_on ?? EXITS;

  const submit = () => {
    setErrors({});
    save.mutate(v, {
      onSuccess: (s) => {
        toast.success(t("editor.saved"));
        if (!sequence) router.replace(`/sequences/${s.id}`);
      },
      onError: (e) => {
        if (isApiError(e) && Object.keys(e.fieldErrors).length) {
          setErrors(
            Object.fromEntries(
              Object.entries(e.fieldErrors).map(([k, x]) => [
                k,
                t(x.code === "required" ? "editor.required" : "editor.invalid"),
              ]),
            ),
          );
          toast.error(te("validation_failed"));
        } else toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
      },
    });
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
          <Field label={t("editor.name")} error={errors.name}>
            <Input required maxLength={120} value={v.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t("editor.client")}>
            <NativeSelect
              value={v.client_id ?? ""}
              onChange={(e) => {
                setClientTouched(true);
                set({ client_id: e.target.value || null });
              }}
            >
              {allowAll && <option value="">{t("allClients")}</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <TriggerCard v={v} set={set} errors={errors} />

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.steps")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {errors.steps && <p className="text-danger text-sm">{t("editor.stepsInvalid")}</p>}
          <ol className="grid gap-2" aria-label={t("editor.steps")}>
            {v.steps.map((s, i) => (
              <StepRow
                key={i}
                i={i}
                s={s}
                count={v.steps.length}
                clientId={v.client_id ?? null}
                errors={errors}
                onChange={(p) => setStep(i, p)}
                onMove={(d) => move(i, d)}
                onRemove={() => set({ steps: v.steps.filter((_, j) => j !== i) })}
              />
            ))}
          </ol>
          {v.steps.length < 12 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-muted me-1 text-sm">{t("editor.addStep")}</span>
              {STEP_TYPES.map((type) => {
                const Icon = STEP_ICON[type];
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => set({ steps: [...v.steps, type === "wait" ? { type, hours: 24 } : { type }] })}
                  >
                    <Icon aria-hidden />
                    {t(`step.type.${type}`)}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.exitsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("editor.exitsTitle")}>
            {EXITS.map((x) => {
              const on = exits.includes(x);
              const locked = x === "opt_out";
              return (
                <button
                  key={x}
                  type="button"
                  aria-pressed={on}
                  disabled={locked}
                  onClick={() => set({ exit_on: on ? exits.filter((y) => y !== x) : [...exits, x] })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted",
                    locked && "cursor-not-allowed",
                  )}
                >
                  {t(`exit.${x}`)}
                </button>
              );
            })}
          </div>
          <Field label={t("editor.holdout")} hint={t("editor.holdoutHint")} error={errors.holdout_percent}>
            <Input
              type="number"
              min={0}
              max={50}
              className="w-28"
              value={v.holdout_percent ?? 10}
              onChange={(e) => set({ holdout_percent: Number(e.target.value) })}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="secondary">
          <Link href={sequence ? `/sequences/${sequence.id}` : "/sequences"}>{t("editor.cancel")}</Link>
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t(sequence ? "editor.save" : "editor.create")}
        </Button>
      </div>
    </form>
  );
}

function TriggerCard({
  v,
  set,
  errors,
}: {
  v: SequenceInput;
  set: (p: Partial<SequenceInput>) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("sequences");
  const tl = useTranslations("lostReason");
  const ts = useTranslations("stage");
  const f = useFormat();
  const tr = v.trigger;
  const setTrigger = (p: Partial<Trigger>) => set({ trigger: { ...tr, ...p } });
  const [debounced, setDebounced] = useState(tr);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(tr), 500);
    return () => clearTimeout(id);
  }, [tr]);
  const preview = usePreview(v.client_id ?? null, debounced, true);
  const toggle = (list: string[] | undefined, x: string) =>
    list?.includes(x) ? list.filter((y) => y !== x) : [...(list ?? []), x];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("editor.who")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("editor.who")}>
          {KINDS.map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              role="radio"
              aria-checked={tr.kind === k}
              variant={tr.kind === k ? "primary" : "secondary"}
              onClick={() => set({ trigger: triggerFor(k, tr) })}
            >
              {t(`trigger.kind.${k}`)}
            </Button>
          ))}
        </div>
        {tr.kind === "no_answer" && (
          <Field label={t("trigger.attempts")} error={errors["trigger.attempts"]}>
            <Input
              type="number"
              min={1}
              max={10}
              className="w-28"
              value={tr.attempts ?? 2}
              onChange={(e) => setTrigger({ attempts: Number(e.target.value) })}
            />
          </Field>
        )}
        {tr.kind === "stale" && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("trigger.stages")}</legend>
            <div className="flex flex-wrap gap-3">
              {STALE_STAGES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tr.stages?.includes(s) ?? false}
                    onChange={() => setTrigger({ stages: toggle(tr.stages, s) as Trigger["stages"] })}
                  />
                  {ts(s)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {tr.kind === "lost" && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("trigger.reasons")}</legend>
            <div className="flex flex-wrap gap-3">
              {LOST_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tr.reasons?.includes(r) ?? false}
                    onChange={() => setTrigger({ reasons: toggle(tr.reasons, r) as Trigger["reasons"] })}
                  />
                  {tl(r)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {(tr.kind === "stale" || tr.kind === "lost") && (
          <Field
            label={t(tr.kind === "stale" ? "trigger.quietDays" : "trigger.lostDays")}
            error={errors["trigger.days"]}
          >
            <Input
              type="number"
              min={tr.kind === "stale" ? 1 : 0}
              max={tr.kind === "stale" ? 90 : 180}
              className="w-28"
              value={tr.days ?? 0}
              onChange={(e) => setTrigger({ days: Number(e.target.value) })}
            />
          </Field>
        )}
        <div className="bg-surface-2 rounded-lg p-3 text-sm" aria-live="polite">
          {tr.kind === "manual" ? (
            <p className="text-muted">{t("trigger.manualHint")}</p>
          ) : preview.data ? (
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="flex items-center gap-2 font-medium">
                  <Users className="size-4" aria-hidden />
                  {t("preview.now", { count: preview.data.eligible_now })}
                  {preview.data.capped && "+"}
                </p>
                <p className="text-muted">{t("preview.month", { count: preview.data.last_30_days })}</p>
              </div>
              {preview.data.sample.length > 0 && (
                <p className="text-muted">
                  {t("preview.sample")}{" "}
                  {preview.data.sample
                    .map((s) => `${s.name || "—"} (${f.relative(s.qualifies_at, Date.now())})`)
                    .join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted">{preview.isError ? t("preview.invalid") : t("preview.loading")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepRow({
  i,
  s,
  count,
  clientId,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  i: number;
  s: Step;
  count: number;
  clientId: string | null;
  errors: Record<string, string>;
  onChange: (p: Partial<Step>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("sequences");
  const { templates, hasWhatsApp, hasSms } = useApprovedTemplates(clientId);
  const Icon = STEP_ICON[s.type];
  const err = (k: string) => errors[`steps[${i}].${k}`];
  const days = s.type === "wait" && (s.hours ?? 0) % 24 === 0;
  return (
    <li className="border-border grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="bg-surface-2 text-muted flex size-7 items-center justify-center rounded-full text-xs tabular-nums">
          {i + 1}
        </span>
        <Icon className="text-muted size-4" aria-hidden />
        <span className="flex-1 text-sm font-medium">{t(`step.type.${s.type}`)}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={i === 0}
          onClick={() => onMove(-1)}
          aria-label={t("editor.moveUp", { n: i + 1 })}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={i === count - 1}
          onClick={() => onMove(1)}
          aria-label={t("editor.moveDown", { n: i + 1 })}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={t("editor.remove", { n: i + 1 })}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {s.type === "wait" && (
        <div className="flex items-end gap-2">
          <Field label={t("step.waitFor")} error={err("hours")}>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={days ? (s.hours ?? 0) / 24 : (s.hours ?? 1)}
              onChange={(e) => onChange({ hours: Number(e.target.value) * (days ? 24 : 1) })}
            />
          </Field>
          <NativeSelect
            aria-label={t("step.unit")}
            className="w-28"
            value={days ? "days" : "hours"}
            onChange={(e) =>
              onChange({ hours: e.target.value === "days" ? Math.max(1, Math.round((s.hours ?? 24) / 24)) * 24 : 1 })
            }
          >
            <option value="days">{t("step.days")}</option>
            <option value="hours">{t("step.hours")}</option>
          </NativeSelect>
        </div>
      )}
      {s.type === "whatsapp_template" &&
        (!clientId ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="text-muted text-sm sm:col-span-2">{t("step.templateAllClients")}</p>
            <Field label={t("step.templateName")} error={err("template_name")}>
              <Input
                dir="ltr"
                value={s.template_name ?? ""}
                onChange={(e) => onChange({ template_name: e.target.value || undefined })}
              />
            </Field>
            <Field label={t("step.templateLanguage")}>
              <Input
                dir="ltr"
                className="w-28"
                value={s.template_language ?? ""}
                onChange={(e) => onChange({ template_language: e.target.value || undefined })}
              />
            </Field>
          </div>
        ) : hasWhatsApp ? (
          <Field label={t("step.template")} error={err("template_name")}>
            <NativeSelect
              value={s.template_name ? `${s.template_name}|${s.template_language}` : ""}
              onChange={(e) => {
                const [name, language] = e.target.value.split("|");
                onChange({ template_name: name || undefined, template_language: language || undefined });
              }}
            >
              <option value="">{t("step.pickTemplate")}</option>
              {templates.map((x) => (
                <option key={x.id} value={`${x.name}|${x.language}`}>
                  {x.name} · {x.language}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <p className="text-warning text-sm">{t("step.noWhatsApp")}</p>
        ))}
      {s.type === "sms" && (
        <>
          {clientId && !hasSms && <p className="text-warning text-sm">{t("step.noSms")}</p>}
          <Field label={t("step.smsText")} hint={t("step.smsHint")} error={err("text")}>
            <Textarea
              rows={2}
              maxLength={480}
              value={s.text ?? ""}
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </Field>
        </>
      )}
      {(s.type === "call_task" || s.type === "ai_draft") && (
        <Field label={t("step.note")} hint={t(`step.${s.type}Hint`)} error={err("note")}>
          <Input maxLength={500} value={s.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} />
        </Field>
      )}
    </li>
  );
}
