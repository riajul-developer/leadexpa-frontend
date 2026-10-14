"use client";

import { Mail, Pause, Play, Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LOCALE_NAMES } from "@/shared/config/locales";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { NativeSelect, Textarea } from "@/shared/ui/input";
import { Badge, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type ScheduleInput, useCreateSchedule, useRuns, useScheduleAction, useSchedules } from "./api";
import { REPORT_LOCALES } from "./share-dialog";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** A template's email schedules (weekly or monthly, in the client's time zone and language) and its sent reports. */
export function ScheduleSheet({ templateId, defaultClient }: { templateId: string; defaultClient: string }) {
  const t = useTranslations("reportBuilder.schedules");
  const f = useFormat();
  const { byId } = useClients();
  const list = useSchedules(templateId);
  const runs = useRuns(templateId);
  const act = useScheduleAction(templateId);
  const rows = list.data?.data ?? [];

  const hour = (h: number) => f.dateTime(`2026-01-05T${String(h).padStart(2, "0")}:00:00Z`, "UTC", "time");
  const action = (id: string, kind: "pause" | "resume" | "send-now" | "delete") =>
    act.mutate(
      { id, action: kind },
      {
        onSuccess: () =>
          toast.success(
            t(
              kind === "send-now" ? "sentNow" : kind === "delete" ? "deleted" : kind === "pause" ? "paused" : "resumed",
            ),
          ),
        onError: (e) => toast.error(isApiError(e) ? e.message : t("failed")),
      },
    );

  return (
    <div className="grid gap-6 p-4">
      <section className="grid gap-3" aria-labelledby="rb-sched-list">
        <h2 id="rb-sched-list" className="text-sm font-semibold">
          {t("active")}
        </h2>
        {list.isPending ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="grid gap-2">
            {rows.map((s) => {
              const client = byId.get(s.client_id);
              const tz = client?.timezone ?? "UTC";
              return (
                <li
                  key={s.id}
                  className="border-border grid gap-2 rounded-lg border p-3 text-sm"
                  data-testid="rb-schedule"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{client?.name ?? "—"}</span>
                    <Badge tone="neutral">{t(`cadence.${s.cadence}`)}</Badge>
                    <Badge tone="neutral">{LOCALE_NAMES[s.locale as "en"] ?? s.locale}</Badge>
                    {!s.active && <Badge tone="warning">{t("pausedBadge")}</Badge>}
                  </div>
                  <p className="text-muted flex items-start gap-1.5 break-all">
                    <Mail aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {s.recipients.join(", ")}
                  </p>
                  <p className="text-muted">
                    {s.active ? t("next", { when: f.dateTime(s.next_run_at, tz) }) : t("pausedHint")}
                    {s.last_run_at && <> · {t("last", { when: f.dateTime(s.last_run_at, tz) })}</>}
                  </p>
                  {s.last_error && (
                    <p role="status" className="text-danger">
                      {t(`errors.${s.last_error}`)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => action(s.id, "send-now")}
                      loading={act.isPending && act.variables?.id === s.id && act.variables.action === "send-now"}
                    >
                      <Send aria-hidden />
                      {t("sendNow")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => action(s.id, s.active ? "pause" : "resume")}>
                      {s.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                      {s.active ? t("pause") : t("resume")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => window.confirm(t("confirmDelete")) && action(s.id, "delete")}
                    >
                      <Trash2 aria-hidden />
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <NewSchedule templateId={templateId} defaultClient={defaultClient} hour={hour} />

      <section className="grid gap-2" aria-labelledby="rb-runs">
        <h2 id="rb-runs" className="text-sm font-semibold">
          {t("history")}
        </h2>
        {(runs.data?.data ?? []).length === 0 ? (
          <EmptyState className="py-4" title={t("noHistory")} />
        ) : (
          <ul className="grid gap-1 text-sm">
            {runs.data!.data.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2">
                <span className="tabular-nums">
                  {f.dateTime(r.created_at, byId.get(r.client_id)?.timezone ?? "UTC")}
                </span>
                <span className="text-muted">{byId.get(r.client_id)?.name}</span>
                <span className="text-muted">
                  {r.schedule_id ? t("kindScheduled") : t("kindShared")} · {r.period_from} – {r.period_to}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewSchedule({
  templateId,
  defaultClient,
  hour,
}: {
  templateId: string;
  defaultClient: string;
  hour: (h: number) => string;
}) {
  const t = useTranslations("reportBuilder.schedules");
  const te = useTranslations("errors");
  const current = useLocale();
  const { clients, byId } = useClients();
  const create = useCreateSchedule(templateId);
  const [clientId, setClientId] = useState(defaultClient || clients[0]?.id || "");
  const [cadence, setCadence] = useState<ScheduleInput["cadence"]>("monthly");
  const [sendHour, setSendHour] = useState(9);
  const [lang, setLang] = useState<ScheduleInput["locale"]>(
    REPORT_LOCALES.includes(current as "en") ? (current as ScheduleInput["locale"]) : "en",
  );
  const [recipients, setRecipients] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emails = recipients
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = emails.length > 0 && emails.length <= 10 && emails.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  return (
    <form
      className="border-border grid gap-3 rounded-xl border p-4"
      aria-labelledby="rb-sched-new"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) {
          setError(t("recipientsInvalid"));
          return;
        }
        setError(null);
        create.mutate(
          { client_id: clientId, cadence, send_hour: sendHour, recipients: emails, locale: lang },
          {
            onSuccess: () => {
              setRecipients("");
              toast.success(t("created"));
            },
            onError: (err) =>
              setError(
                isApiError(err) && te.has(err.code) ? te(err.code) : isApiError(err) ? err.message : t("failed"),
              ),
          },
        );
      }}
    >
      <h2 id="rb-sched-new" className="text-sm font-semibold">
        {t("new")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("client")}
          hint={byId.get(clientId) ? t("zoneHint", { zone: byId.get(clientId)!.timezone }) : undefined}
        >
          <NativeSelect value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("cadenceLabel")} hint={t(`cadenceHint.${cadence}`)}>
          <NativeSelect value={cadence} onChange={(e) => setCadence(e.target.value as ScheduleInput["cadence"])}>
            <option value="weekly">{t("cadence.weekly")}</option>
            <option value="monthly">{t("cadence.monthly")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("hour")}>
          <NativeSelect value={sendHour} onChange={(e) => setSendHour(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hour(h)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("language")}>
          <NativeSelect value={lang} onChange={(e) => setLang(e.target.value as ScheduleInput["locale"])}>
            {REPORT_LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t("recipients")} hint={t("recipientsHint")} error={error ?? undefined}>
        <Textarea
          rows={2}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="owner@client.com, manager@client.com"
          dir="ltr"
        />
      </Field>
      <Button type="submit" loading={create.isPending} disabled={!clientId} className="justify-self-start">
        {t("create")}
      </Button>
    </form>
  );
}
