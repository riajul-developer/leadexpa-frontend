"use client";

import { useQuery } from "@tanstack/react-query";
import { Check as CheckIcon, Copy, FlaskConical, History, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients, useMembers } from "@/shared/lib/lookups";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives";

import {
  useLeadSearch,
  useSaveRule,
  useSimulate,
  useTestRule,
  type Action,
  type ActionType,
  type Check,
  type Condition,
  type Rule,
  type RuleInput,
} from "./api";
import { ACTIONS, EVENTS, FIELDS, OPS, OPTIONS, fieldDef, needsValue, type ValueInput } from "./catalog";

const BLANK: RuleInput = {
  name: "",
  client_id: null,
  event: "lead.created",
  conditions: { match: "all", rules: [{ field: "lead.source_kind", op: "eq", value: "meta_lead_ads" }] },
  actions: [{ type: "tag", tags: ["meta"] }],
  rate_per_hour: 100,
};

const NEW_ACTION: Record<ActionType, Action> = {
  assign: { type: "assign", round_robin: true },
  tag: { type: "tag", tags: [] },
  set_priority: { type: "set_priority", priority: 5 },
  notify: { type: "notify", to: ["owner"], message: "" },
  enroll_sequence: { type: "enroll_sequence", sequence_id: "" },
  create_task: { type: "create_task", note: "" },
  send_webhook: { type: "send_webhook", url: "https://" },
};

export function RuleBuilder({ rule, defaultClient }: { rule?: Rule; defaultClient?: string }) {
  const t = useTranslations("automations");
  const te = useTranslations("errors");
  const router = useRouter();
  const { data: me } = useMe();
  const { clients } = useClients();
  const allowAll = me?.membership?.role === "owner" || me?.membership?.role === "admin";
  const [v, setV] = useState<RuleInput>(() =>
    rule
      ? {
          name: rule.name,
          client_id: rule.client_id,
          event: rule.event as RuleInput["event"],
          conditions: rule.conditions,
          actions: rule.actions,
          rate_per_hour: rule.rate_per_hour,
        }
      : { ...BLANK, client_id: defaultClient ?? null },
  );
  const [touched, setTouched] = useState(false);
  const firstClient = clients[0]?.id;
  useEffect(() => {
    if (!rule && !touched && !allowAll && firstClient)
      setV((x) => (x.client_id ? x : { ...x, client_id: firstClient }));
  }, [rule, touched, allowAll, firstClient]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useSaveRule(rule?.id ?? null);
  const set = (p: Partial<RuleInput>) => setV((x) => ({ ...x, ...p }));
  const rules = v.conditions.rules;
  const setCond = (i: number, p: Partial<Condition>) =>
    set({ conditions: { ...v.conditions, rules: rules.map((c, j) => (j === i ? { ...c, ...p } : c)) } });
  const setAction = (i: number, p: Partial<Action>) =>
    set({ actions: v.actions.map((a, j) => (j === i ? { ...a, ...p } : a)) });

  const submit = () => {
    setErrors({});
    save.mutate(v, {
      onSuccess: (r) => {
        toast.success(t("builder.saved"));
        if (!rule) router.replace(`/automations/${r.id}`);
      },
      onError: (e) => {
        if (isApiError(e) && Object.keys(e.fieldErrors).length) {
          setErrors(Object.fromEntries(Object.keys(e.fieldErrors).map((k) => [k, t("builder.invalid")])));
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
          <Field label={t("builder.name")} error={errors.name}>
            <Input required maxLength={120} value={v.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t("builder.client")}>
            <NativeSelect
              value={v.client_id ?? ""}
              onChange={(e) => {
                setTouched(true);
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

      <Card>
        <CardHeader>
          <CardTitle>{t("builder.when")}</CardTitle>
        </CardHeader>
        <CardContent>
          <NativeSelect
            aria-label={t("builder.when")}
            value={v.event}
            onChange={(e) => {
              const event = e.target.value as RuleInput["event"];
              // Event fields of another event no longer apply.
              const keep = rules.filter(
                (c) => !fieldDef(c.field)?.events || fieldDef(c.field)!.events!.includes(event),
              );
              set({ event, conditions: { ...v.conditions, rules: keep } });
            }}
          >
            {EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {t(`event.${ev.replace(".", "_")}`)}
              </option>
            ))}
          </NativeSelect>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-2">
          <CardTitle>{t("builder.if")}</CardTitle>
          <NativeSelect
            aria-label={t("builder.match")}
            className="w-auto"
            value={v.conditions.match ?? "all"}
            onChange={(e) => set({ conditions: { ...v.conditions, match: e.target.value as "all" | "any" } })}
          >
            <option value="all">{t("builder.matchAll")}</option>
            <option value="any">{t("builder.matchAny")}</option>
          </NativeSelect>
        </CardHeader>
        <CardContent className="grid gap-2">
          {rules.length === 0 && <p className="text-muted text-sm">{t("builder.always")}</p>}
          <ol className="grid gap-2" aria-label={t("builder.if")}>
            {rules.map((c, i) => (
              <ConditionRow
                key={i}
                i={i}
                c={c}
                event={v.event}
                error={Object.keys(errors).some((k) => k.startsWith(`conditions.rules[${i}]`))}
                onChange={(p) => setCond(i, p)}
                onRemove={() => set({ conditions: { ...v.conditions, rules: rules.filter((_, j) => j !== i) } })}
              />
            ))}
          </ol>
          {rules.length < 20 && (
            <div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  set({
                    conditions: { ...v.conditions, rules: [...rules, { field: "lead.stage", op: "eq", value: "new" }] },
                  })
                }
              >
                <Plus aria-hidden />
                {t("builder.addCondition")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("builder.then")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {errors.actions && <p className="text-danger text-sm">{t("builder.actionsInvalid")}</p>}
          <ol className="grid gap-2" aria-label={t("builder.then")}>
            {v.actions.map((a, i) => (
              <ActionRow
                key={i}
                i={i}
                a={a}
                clientId={v.client_id ?? null}
                secret={rule?.webhook_secret ?? null}
                error={Object.keys(errors).some((k) => k.startsWith(`actions[${i}]`))}
                onChange={(p) => setAction(i, p)}
                onRemove={() => set({ actions: v.actions.filter((_, j) => j !== i) })}
              />
            ))}
          </ol>
          {v.actions.length < 5 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted me-1 text-sm">{t("builder.addAction")}</span>
              {ACTIONS.map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => set({ actions: [...v.actions, NEW_ACTION[type]] })}
                >
                  {t(`action.${type}`)}
                </Button>
              ))}
            </div>
          )}
          <Field label={t("builder.rate")} hint={t("builder.rateHint")} error={errors.rate_per_hour}>
            <Input
              type="number"
              min={1}
              max={10000}
              className="w-32"
              value={v.rate_per_hour ?? 100}
              onChange={(e) => set({ rate_per_hour: Number(e.target.value) })}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="secondary">
          <Link href={rule ? `/automations/${rule.id}` : "/automations"}>{t("builder.cancel")}</Link>
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t(rule ? "builder.save" : "builder.create")}
        </Button>
      </div>

      <TryIt rule={v} />
    </form>
  );
}

function ConditionRow({
  i,
  c,
  event,
  error,
  onChange,
  onRemove,
}: {
  i: number;
  c: Condition;
  event: RuleInput["event"];
  error: boolean;
  onChange: (p: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("automations");
  const def = fieldDef(c.field);
  const kind = def?.kind ?? "text";
  const isCustom = c.field.startsWith("custom.");
  const fields = FIELDS.filter((f) => !f.events || f.events.includes(event));
  return (
    <li
      className={`grid gap-2 rounded-lg border p-2 sm:grid-cols-[12rem_10rem_1fr_auto] ${error ? "border-danger" : "border-border"}`}
    >
      <div className="grid gap-1">
        <NativeSelect
          aria-label={t("builder.field", { n: i + 1 })}
          value={isCustom ? "custom" : c.field}
          onChange={(e) => {
            const key = e.target.value === "custom" ? "custom.service" : e.target.value;
            const k = fieldDef(key)?.kind ?? "text";
            onChange({ field: key, op: OPS[k][0], value: k === "bool" ? true : undefined });
          }}
        >
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {t(`field.${f.key.replace(".", "_")}`)}
            </option>
          ))}
        </NativeSelect>
        {isCustom && (
          <Input
            aria-label={t("builder.customKey")}
            dir="ltr"
            value={c.field.slice("custom.".length)}
            onChange={(e) => onChange({ field: `custom.${e.target.value.trim().toLowerCase()}` })}
          />
        )}
      </div>
      <NativeSelect
        aria-label={t("builder.op", { n: i + 1 })}
        value={c.op}
        onChange={(e) => onChange({ op: e.target.value as Condition["op"] })}
      >
        {OPS[kind].map((op) => (
          <option key={op} value={op}>
            {t(`op.${op}`)}
          </option>
        ))}
      </NativeSelect>
      {needsValue(c.op) ? (
        <ValueField
          input={def?.input ?? "text"}
          multi={c.op === "in" || c.op === "not_in"}
          value={c.value}
          label={t("builder.value", { n: i + 1 })}
          onChange={(value) => onChange({ value })}
        />
      ) : (
        <span />
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        aria-label={t("builder.removeCondition", { n: i + 1 })}
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

function ValueField({
  input,
  multi,
  value,
  label,
  onChange,
}: {
  input: ValueInput;
  multi: boolean;
  value: unknown;
  label: string;
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations("automations");
  const { clients } = useClients();
  const { members } = useMembers();
  const options: { value: string; label: string }[] | undefined =
    input === "client"
      ? clients.map((c) => ({ value: c.id, label: c.name }))
      : input === "member"
        ? members.filter((m) => m.status === "active").map((m) => ({ value: m.user.id, label: m.user.name }))
        : OPTIONS[input]?.map((o) => ({ value: o, label: t.has(`value.${o}`) ? t(`value.${o}`) : o }));
  if (input === "bool")
    return (
      <NativeSelect
        aria-label={label}
        value={String(value ?? true)}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <option value="true">{t("value.yes")}</option>
        <option value="false">{t("value.no")}</option>
      </NativeSelect>
    );
  if (input === "number")
    return (
      <Input
        aria-label={label}
        type="number"
        value={String(value ?? "")}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  if (multi) {
    const list = Array.isArray(value) ? (value as string[]) : [];
    if (options)
      return (
        <div role="group" aria-label={label} className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={list.includes(o.value)}
                onChange={() =>
                  onChange(list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value])
                }
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    return (
      <Input
        aria-label={label}
        placeholder={t("builder.commaSeparated")}
        value={list.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }
  if (options)
    return (
      <NativeSelect aria-label={label} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    );
  return <Input aria-label={label} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}

function ActionRow({
  i,
  a,
  clientId,
  secret,
  error,
  onChange,
  onRemove,
}: {
  i: number;
  a: Action;
  clientId: string | null;
  secret: string | null;
  error: boolean;
  onChange: (p: Partial<Action>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("automations");
  const { members } = useMembers();
  const sequences = useQuery({
    queryKey: ["automation", "sequences", clientId],
    queryFn: () => unwrap(api.GET("/v1/sequences", { params: { query: { client_id: clientId ?? undefined } } })),
    enabled: a.type === "enroll_sequence",
  });
  const active = members.filter((m) => m.status === "active" && m.role !== "client_viewer");
  const to = a.to ?? [];
  return (
    <li className={`grid gap-2 rounded-lg border p-3 ${error ? "border-danger" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <span className="bg-surface-2 text-muted flex size-6 items-center justify-center rounded-full text-xs tabular-nums">
          {i + 1}
        </span>
        <span className="flex-1 text-sm font-medium">{t(`action.${a.type}`)}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={t("builder.removeAction", { n: i + 1 })}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {a.type === "assign" && (
        <NativeSelect
          aria-label={t("action.assign")}
          value={a.round_robin ? "__rr" : (a.user_id ?? "")}
          onChange={(e) =>
            onChange(
              e.target.value === "__rr"
                ? { round_robin: true, user_id: undefined }
                : { round_robin: false, user_id: e.target.value },
            )
          }
        >
          <option value="__rr">{t("builder.rotation")}</option>
          {active.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {a.type === "tag" && (
        <Input
          aria-label={t("action.tag")}
          placeholder={t("builder.commaSeparated")}
          value={(a.tags ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              tags: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      )}
      {a.type === "set_priority" && (
        <Input
          aria-label={t("action.set_priority")}
          type="number"
          min={0}
          max={100}
          className="w-28"
          value={a.priority ?? 0}
          onChange={(e) => onChange({ priority: Number(e.target.value) })}
        />
      )}
      {a.type === "notify" && (
        <>
          <div role="group" aria-label={t("builder.notifyWho")} className="flex flex-wrap gap-3 text-sm">
            {(["owner", "managers", "admins"] as const).map((x) => (
              <label key={x} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={to.includes(x)}
                  onChange={() => onChange({ to: to.includes(x) ? to.filter((y) => y !== x) : [...to, x] })}
                />
                {t(`builder.to.${x}`)}
              </label>
            ))}
          </div>
          <Textarea
            aria-label={t("builder.message")}
            rows={2}
            maxLength={280}
            value={a.message ?? ""}
            onChange={(e) => onChange({ message: e.target.value })}
          />
        </>
      )}
      {a.type === "enroll_sequence" && (
        <NativeSelect
          aria-label={t("action.enroll_sequence")}
          value={a.sequence_id ?? ""}
          onChange={(e) => onChange({ sequence_id: e.target.value })}
        >
          <option value="">{t("builder.pickSequence")}</option>
          {(sequences.data?.data ?? [])
            .filter((s) => s.status === "active")
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </NativeSelect>
      )}
      {a.type === "create_task" && (
        <Input
          aria-label={t("builder.taskNote")}
          maxLength={500}
          value={a.note ?? ""}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      )}
      {a.type === "send_webhook" && (
        <>
          <Input
            aria-label={t("builder.webhookUrl")}
            dir="ltr"
            type="url"
            value={a.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value })}
          />
          <p className="text-muted text-xs">{t("builder.webhookHint")}</p>
          {secret && <SecretLine secret={secret} />}
        </>
      )}
    </li>
  );
}

function SecretLine({ secret }: { secret: string }) {
  const t = useTranslations("automations");
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted">{t("builder.secret")}</span>
      <code className="bg-surface-2 min-w-0 flex-1 truncate rounded px-2 py-1" dir="ltr">
        {secret}
      </code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={t("builder.copySecret")}
        onClick={() => void navigator.clipboard.writeText(secret).then(() => toast.success(t("builder.copied")))}
      >
        <Copy aria-hidden />
      </Button>
    </span>
  );
}

function TryIt({ rule }: { rule: RuleInput }) {
  const t = useTranslations("automations");
  const te = useTranslations("errors");
  const f = useFormat();
  const [q, setQ] = useState("");
  const search = useLeadSearch(q);
  const test = useTestRule();
  const sim = useSimulate();
  const fail = (e: unknown) =>
    toast.error(
      isApiError(e) && e.status === 422
        ? te("validation_failed")
        : isApiError(e) && te.has(e.code)
          ? te(e.code)
          : te("internal"),
    );
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <FlaskConical className="text-muted size-4" aria-hidden />
        <CardTitle>{t("try.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <section className="grid content-start gap-2" aria-labelledby="try-test">
          <h3 id="try-test" className="text-sm font-semibold">
            {t("try.test")}
          </h3>
          <Input
            type="search"
            aria-label={t("try.searchLead")}
            placeholder={t("try.searchLead")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="grid gap-1">
            {(search.data?.data ?? []).map((l) => (
              <li key={l.id}>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => test.mutate({ rule, lead_id: l.id }, { onError: fail })}
                >
                  {l.full_name || l.phone?.display || "—"}
                </Button>
              </li>
            ))}
          </ul>
          {test.data && (
            <div className="grid gap-2 text-sm" aria-live="polite">
              <Badge tone={test.data.matched ? "success" : "neutral"}>
                {t(test.data.matched ? "try.wouldFire" : "try.wouldNotFire")}
              </Badge>
              <Checks checks={test.data.checks} />
            </div>
          )}
        </section>
        <section className="grid content-start gap-2" aria-labelledby="try-sim">
          <h3 id="try-sim" className="text-sm font-semibold">
            {t("try.simulate")}
          </h3>
          <div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={sim.isPending}
              onClick={() => sim.mutate(rule, { onError: fail })}
            >
              <History aria-hidden />
              {t("try.run")}
            </Button>
          </div>
          <p className="text-muted text-sm">{t("try.simulateHint")}</p>
          {sim.data && (
            <div className="grid gap-1 text-sm" aria-live="polite">
              <p className="font-medium">{t("try.result", { matched: sim.data.matched, events: sim.data.events })}</p>
              <ul className="text-muted grid gap-0.5">
                {sim.data.sample.map((s) => (
                  <li key={s.event_id}>
                    {s.lead_name || "—"} · {f.relative(s.at, Date.now())}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  const t = useTranslations("automations");
  if (checks.length === 0) return <p className="text-muted text-sm">{t("builder.always")}</p>;
  const show = (v: unknown) => (v == null || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : String(v));
  return (
    <ul className="grid gap-1 text-sm">
      {checks.map((c, i) => (
        <li key={i} className="flex items-start gap-2">
          {c.result ? (
            <CheckIcon className="text-success mt-0.5 size-4 shrink-0" aria-label={t("try.passed")} />
          ) : (
            <X className="text-danger mt-0.5 size-4 shrink-0" aria-label={t("try.failed")} />
          )}
          <span>
            {c.field.startsWith("custom.") ? c.field : t(`field.${c.field.replace(".", "_")}`)} {t(`op.${c.op}`)}{" "}
            <b>{show(c.value)}</b>
            <span className="text-muted"> · {t("try.actual", { value: show(c.actual) })}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
