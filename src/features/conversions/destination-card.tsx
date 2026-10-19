"use client";

import { ChevronDown, FlaskConical, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Skeleton } from "@/shared/ui/primitives";

import {
  TRIGGERS,
  triggerKey,
  useDeleteDestination,
  useDestinationEvents,
  useDestinationStats,
  useGoogleActions,
  useRetryDestination,
  useTestDestination,
  useUpdateDestination,
  type ConversionEvent,
  type Destination,
} from "./api";
import { HealthBadge, PLATFORM_NAME, PlatformIcon } from "./parts";

const KEYS = ["lead_id", "gclid", "em", "ph", "fn", "country", "fbc"] as const;
const STATUS_TONE = {
  pending: "neutral",
  sent: "success",
  failed: "warning",
  skipped: "neutral",
  dead: "danger",
} as const;

export function DestinationCard({ d, accepted }: { d: Destination; accepted: boolean }) {
  const t = useTranslations("conversions");
  const te = useTranslations("errors");
  const f = useFormat();
  const now = useNow();
  const update = useUpdateDestination(d);
  const remove = useDeleteDestination(d);
  const test = useTestDestination(d.id);
  const retry = useRetryDestination(d.id);
  const [open, setOpen] = useState<"" | "mapping" | "log">("");
  const fail = (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
  const paused = d.status === "paused";

  return (
    <section aria-label={d.name} className="border-border grid gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformIcon platform={d.platform} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{d.name}</p>
          <p className="text-muted truncate text-xs" dir="auto">
            {PLATFORM_NAME[d.platform]} · {d.platform === "meta" ? d.dataset_id : d.customer_id}
            {d.test_event_code && ` · ${t("testMode")}`}
          </p>
        </div>
        <HealthBadge health={d.health} paused={paused} />
      </div>
      {!accepted && <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm">{t("notAccepted")}</p>}
      {d.last_error && d.health !== "healthy" && (
        <p className="text-danger text-sm">
          {t("lastError")}: {d.last_error}
        </p>
      )}
      <Stats id={d.id} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={test.isPending}
          onClick={() =>
            test.mutate(undefined, {
              onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
              onError: fail,
            })
          }
        >
          <FlaskConical aria-hidden />
          {t("test")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={update.isPending}
          onClick={() => update.mutate({ status: paused ? "active" : "paused" }, { onError: fail })}
        >
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {paused ? t("resume") : t("pause")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={retry.isPending}
          onClick={() =>
            retry.mutate(undefined, { onSuccess: (r) => toast.success(t("requeued", { count: r.requeued })) })
          }
        >
          <RotateCcw aria-hidden />
          {t("retry")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={remove.isPending}
          onClick={() => window.confirm(t("removeConfirm")) && remove.mutate(undefined, { onError: fail })}
        >
          <Trash2 aria-hidden />
          {t("remove")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["mapping", "log"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="text-primary flex items-center gap-1 font-medium"
            aria-expanded={open === k}
            onClick={() => setOpen(open === k ? "" : k)}
          >
            <ChevronDown className={open === k ? "size-4 rotate-180" : "size-4"} aria-hidden />
            {t(k === "mapping" ? "mappingTitle" : "logTitle")}
          </button>
        ))}
      </div>
      {open === "mapping" && <MappingEditor key={JSON.stringify(d.mapping)} d={d} />}
      {open === "log" && <EventLog id={d.id} now={now} format={f} />}
    </section>
  );
}

function Stats({ id }: { id: string }) {
  const t = useTranslations("conversions.stats");
  const f = useFormat();
  const now = useNow();
  const q = useDestinationStats(id);
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  const s = q.data;
  if (!s) return null;
  const tiles = [
    ["sent", s.sent],
    ["skipped", s.by_status.skipped ?? 0],
    ["failed", (s.by_status.failed ?? 0) + (s.by_status.dead ?? 0)],
    ["pending", s.by_status.pending ?? 0],
  ] as const;
  return (
    <div className="grid gap-2">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([k, n]) => (
          <li key={k} className="bg-surface-2 rounded-lg p-2">
            <p className="text-muted text-xs">{t(k, { days: s.days })}</p>
            <p className="text-lg font-semibold tabular-nums">{f.number(n)}</p>
          </li>
        ))}
      </ul>
      <p className="text-muted text-xs">
        {s.last_sent_at ? t("lastSent", { when: f.relative(s.last_sent_at, now || Date.now()) }) : t("neverSent")}
        {s.consent_coverage != null && ` · ${t("consent", { pct: f.percent(s.consent_coverage, 0) })}`}
      </p>
      {s.sent > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted">{t("matchKeys")}</span>
          {KEYS.filter((k) => s.match_keys[k]).map((k) => (
            <Badge key={k} tone="primary">
              {t(`key.${k}`)} {f.percent((s.match_keys[k] ?? 0) / s.sent, 0)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function MappingEditor({ d }: { d: Destination }) {
  const t = useTranslations("conversions");
  const te = useTranslations("errors");
  const update = useUpdateDestination(d);
  const [mapping, setMapping] = useState<Record<string, string>>({ ...d.mapping });
  const [sendValue, setSendValue] = useState(d.send_value);
  const [testCode, setTestCode] = useState(d.test_event_code ?? "");
  const [token, setToken] = useState("");
  const actions = useGoogleActions(d.google_connection_id ?? undefined, d.customer_id ?? "", d.login_customer_id ?? "");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        mapping,
        send_value: sendValue,
        ...(d.platform === "meta" ? { test_event_code: testCode.trim() } : {}),
        ...(token.trim() ? { access_token: token.trim() } : {}),
      },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (err) =>
          toast.error(
            isApiError(err) && err.status === 422
              ? te("validation_failed")
              : isApiError(err) && te.has(err.code)
                ? te(err.code)
                : te("internal"),
          ),
      },
    );
  };

  return (
    <form className="grid gap-3" onSubmit={save}>
      <p className="text-muted text-sm">{t(d.platform === "meta" ? "mappingHintMeta" : "mappingHintGoogle")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {TRIGGERS.map((tr) => (
          <Field key={tr} label={t(`trigger.${triggerKey(tr)}`)}>
            {d.platform === "meta" ? (
              <Input
                value={mapping[tr] ?? ""}
                maxLength={50}
                placeholder={t("notSent")}
                onChange={(e) => setMapping({ ...mapping, [tr]: e.target.value })}
              />
            ) : (
              <NativeSelect
                value={mapping[tr] ?? ""}
                onChange={(e) => setMapping({ ...mapping, [tr]: e.target.value })}
              >
                <option value="">{t("notSent")}</option>
                {(actions.data?.data ?? []).map((a) => (
                  <option key={a.resource_name} value={a.resource_name}>
                    {a.name}
                  </option>
                ))}
                {mapping[tr] && !actions.data?.data.some((a) => a.resource_name === mapping[tr]) && (
                  <option value={mapping[tr]}>{mapping[tr]}</option>
                )}
              </NativeSelect>
            )}
          </Field>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={sendValue} onCheckedChange={setSendValue} aria-label={t("sendValue")} />
        {t("sendValue")}
      </label>
      {d.platform === "meta" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("testEventCode")} hint={t("testEventCodeHint")}>
            <Input value={testCode} maxLength={40} onChange={(e) => setTestCode(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t("replaceToken")} hint={t("replaceTokenHint")}>
            <Input
              type="password"
              value={token}
              autoComplete="off"
              onChange={(e) => setToken(e.target.value)}
              dir="ltr"
            />
          </Field>
        </div>
      )}
      <Button type="submit" className="w-fit" loading={update.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}

function EventLog({ id, now, format: f }: { id: string; now: number; format: ReturnType<typeof useFormat> }) {
  const t = useTranslations("conversions");
  const tz = useDisplayTimeZone();
  const [status, setStatus] = useState<"" | ConversionEvent["status"]>("");
  const q = useDestinationEvents(id, status, true);
  return (
    <div className="grid gap-2">
      <Field label={t("log.filter")} className="w-48">
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">{t("log.all")}</option>
          {(["sent", "pending", "failed", "skipped", "dead"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {q.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : !q.data?.data.length ? (
        <p className="text-muted text-sm">{t("log.empty")}</p>
      ) : (
        <ul className="divide-border grid divide-y text-sm">
          {q.data.data.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
              <Badge tone={STATUS_TONE[e.status]}>{t(`status.${e.status}`)}</Badge>
              <span className="font-medium">{t(`trigger.${triggerKey(e.trigger)}`)}</span>
              <span className="text-muted text-xs">
                {f.dateTime(e.event_time, tz, "short")}
                {e.value_minor != null &&
                  e.currency &&
                  ` · ${f.money({ amount_minor: e.value_minor, currency: e.currency })}`}
              </span>
              {e.skip_reason && <span className="text-muted text-xs">{skipLabel(t, e.skip_reason)}</span>}
              {e.last_error && <span className="text-danger text-xs">{e.last_error}</span>}
              {e.status === "failed" && e.next_attempt_at && (
                <span className="text-muted text-xs">
                  {t("log.retryIn", { when: f.relative(e.next_attempt_at, now || Date.now()) })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function skipLabel(t: ReturnType<typeof useTranslations<"conversions">>, reason: string) {
  if (reason.startsWith("policy:")) {
    const r = reason.slice(7);
    return t.has(`skip.policy.${r}`) ? t(`skip.policy.${r}`) : t("skip.policy.other");
  }
  return t.has(`skip.${reason}`) ? t(`skip.${reason}`) : reason;
}
