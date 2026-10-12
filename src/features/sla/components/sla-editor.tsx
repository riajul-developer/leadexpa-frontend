"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { intlLocale, type FormatOptions } from "@/shared/lib/format";
import { useClients } from "@/shared/lib/lookups";
import { usePreferences } from "@/shared/lib/preferences";
import { clientKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Checkbox, Switch } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

type Policy = Schemas["SLAPolicyInput"];
type Step = Schemas["EscalationStep"];
type Recipient = Step["notify"][number];

export const SLA_PRESETS = { fast: 5, standard: 15, relaxed: 60 } as const;
const RECIPIENTS: Recipient[] = ["owner", "client_managers", "agency_admins"];

/** A sample "Thursday 18:55" in the client's timezone, for the plain-language preview. */
function sampleArrival(tz: string): string {
  const now = new Date();
  const day = now.getUTCDay();
  const add = (4 - day + 7) % 7 || 7; // next Thursday
  const d = new Date(now.getTime() + add * 86400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  // Offset of tz at that date, so 18:55 is local wall time.
  const probe = new Date(`${ymd}T18:55:00Z`);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
  const offset = local.getTime() - new Date(probe.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(probe.getTime() - offset).toISOString();
}

export function SlaPolicyEditor({
  clientId,
  timeZone,
  onSaved,
}: {
  clientId: string;
  timeZone: string;
  onSaved?: () => void;
}) {
  const t = useTranslations("sla.editor");
  const f = useFormat();
  const qc = useQueryClient();
  const canManage = useCan("sla.policy.manage");
  const q = useQuery({
    queryKey: clientKeys.slaPolicy(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/sla-policy", { params: { path: { clientId } } })),
  });
  const [p, setP] = useState<Policy | null>(null);
  useEffect(() => {
    if (q.data) {
      const { is_default: _ignored, ...rest } = q.data;
      setP(rest);
    }
  }, [q.data]);

  // Live preview from the API (business-time math lives on the server only).
  const arrival = useMemo(() => sampleArrival(timeZone), [timeZone]);
  const [debounced, setDebounced] = useState<Policy | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(p), 400);
    return () => clearTimeout(id);
  }, [p]);
  const preview = useQuery({
    queryKey: ["sla-preview", clientId, debounced],
    queryFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/sla-policy/preview", {
          params: { path: { clientId } },
          body: { received_at: arrival, policy: debounced! },
        }),
      ),
    enabled: !!debounced,
    meta: { silent: true },
  });

  const save = useMutation({
    mutationFn: (body: Policy) =>
      unwrap(api.PUT("/v1/clients/{clientId}/sla-policy", { params: { path: { clientId } }, body })),
    onSuccess: (r) => {
      qc.setQueryData(clientKeys.slaPolicy(clientId), r);
      track("sla.policy.saved", { minutes: r.first_response_minutes, business_hours: r.business_hours_only });
      toast.success(t("saved"));
      onSaved?.();
    },
  });

  if (!p) return <Skeleton className="h-96 w-full" />;
  const setStep = (i: number, s: Partial<Step>) =>
    setP({ ...p, escalation_ladder: p.escalation_ladder.map((x, j) => (j === i ? { ...x, ...s } : x)) });
  const contactedFollowUp = p.follow_up_rules?.contacted;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("firstResponse")}</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="sla-active">{t("active")}</label>
            <Switch
              id="sla-active"
              checked={p.active}
              onCheckedChange={(v) => setP({ ...p, active: v })}
              disabled={!canManage}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("presets")}>
            {(Object.entries(SLA_PRESETS) as [keyof typeof SLA_PRESETS, number][]).map(([k, minutes]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={p.first_response_minutes === minutes}
                disabled={!canManage}
                onClick={() => setP({ ...p, first_response_minutes: minutes })}
                className={cn(
                  "rounded-card border p-3 text-start",
                  p.first_response_minutes === minutes
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-surface-2",
                )}
              >
                <span className="block font-semibold">{t(`preset.${k}`)}</span>
                <span className="text-muted text-sm">{t("minutes", { n: minutes })}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("customMinutes")}>
              <Input
                type="number"
                min={1}
                max={10080}
                value={p.first_response_minutes}
                disabled={!canManage}
                onChange={(e) => setP({ ...p, first_response_minutes: Math.max(1, Number(e.target.value) || 1) })}
              />
            </Field>
            <Field label={t("measure")} hint={t(`measureHint.${p.measure}`)}>
              <NativeSelect
                value={p.measure}
                disabled={!canManage}
                onChange={(e) => setP({ ...p, measure: e.target.value as Policy["measure"] })}
              >
                <option value="attempt">{t("measureAttempt")}</option>
                <option value="response">{t("measureResponse")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("warnAt")}>
              <Input
                type="number"
                min={10}
                max={95}
                step={5}
                value={p.warn_at_percent}
                disabled={!canManage}
                onChange={(e) => setP({ ...p, warn_at_percent: Number(e.target.value) || 80 })}
              />
            </Field>
          </div>
          <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <label htmlFor="sla-bh" className="text-sm font-medium">
                {t("businessHours")}
              </label>
              <p className="text-muted text-sm">{t("businessHoursHint")}</p>
            </div>
            <Switch
              id="sla-bh"
              checked={p.business_hours_only}
              disabled={!canManage}
              onCheckedChange={(v) => setP({ ...p, business_hours_only: v })}
            />
          </div>
          <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <label htmlFor="sla-junk" className="text-sm font-medium">
                {t("junkSla")}
              </label>
              <p className="text-muted text-sm">{t("junkSlaHint")}</p>
            </div>
            <Switch
              id="sla-junk"
              checked={p.junk_sla}
              disabled={!canManage}
              onCheckedChange={(v) => setP({ ...p, junk_sla: v })}
            />
          </div>
          <Field label={t("followUp")} hint={t("followUpHint")}>
            <Input
              type="number"
              min={0}
              placeholder="—"
              value={contactedFollowUp ?? ""}
              disabled={!canManage}
              onChange={(e) => {
                const v = e.target.value === "" ? undefined : Math.max(1, Number(e.target.value));
                const rules = { ...(p.follow_up_rules ?? {}) };
                if (v === undefined) delete rules.contacted;
                else rules.contacted = v;
                setP({ ...p, follow_up_rules: rules });
              }}
            />
          </Field>
          <p role="status" aria-live="polite" className="bg-info-soft text-info rounded-lg px-3 py-2 text-sm">
            {preview.data
              ? t("preview", {
                  arrival: f.dateTime(preview.data.received_at, preview.data.timezone, "short"),
                  due: f.dateTime(preview.data.due_at, preview.data.timezone, "short"),
                })
              : t("previewLoading")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ladder")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ol className="grid gap-3">
            {p.escalation_ladder.map((s, i) => (
              <li
                key={i}
                className="border-border grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <span className="text-sm font-semibold">{t("level", { n: s.level })}</span>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-2">
                    {t("after")}
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-20"
                      value={s.after_breach_minutes}
                      disabled={!canManage}
                      onChange={(e) => setStep(i, { after_breach_minutes: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label={t("afterMinutes")}
                    />
                    {t("minutesAfterBreach")}
                  </label>
                  <fieldset className="flex flex-wrap gap-3">
                    <legend className="sr-only">{t("notify")}</legend>
                    {RECIPIENTS.map((r) => (
                      <label key={r} className="inline-flex items-center gap-1.5">
                        <Checkbox
                          checked={s.notify.includes(r)}
                          disabled={!canManage}
                          onCheckedChange={(v) =>
                            setStep(i, { notify: v ? [...s.notify, r] : s.notify.filter((x) => x !== r) })
                          }
                        />
                        {t(`recipient.${r}`)}
                      </label>
                    ))}
                  </fieldset>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeLevel", { n: s.level })}
                    onClick={() =>
                      setP({
                        ...p,
                        escalation_ladder: p.escalation_ladder
                          .filter((_, j) => j !== i)
                          .map((x, j) => ({ ...x, level: j + 1 })),
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ol>
          {canManage && p.escalation_ladder.length < 5 && (
            <Button
              variant="secondary"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                setP({
                  ...p,
                  escalation_ladder: [
                    ...p.escalation_ladder,
                    {
                      level: p.escalation_ladder.length + 1,
                      after_breach_minutes: p.escalation_ladder.length ? 60 : 0,
                      notify: p.escalation_ladder.length ? ["agency_admins"] : ["owner", "client_managers"],
                    },
                  ],
                })
              }
            >
              <Plus aria-hidden />
              {t("addLevel")}
            </Button>
          )}
        </CardContent>
      </Card>
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(p)} loading={save.isPending}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

const ISO_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof ISO_DAYS)[number];

/** Days in the order the user's locale starts the week (Saturday in Bangladesh, Sunday in the US…). */
function weekOrder(locale: string): Day[] {
  let first = 1;
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    first = l.getWeekInfo?.().firstDay ?? l.weekInfo?.firstDay ?? 1;
  } catch {
    // older browsers: ISO order
  }
  return [...ISO_DAYS.slice(first - 1), ...ISO_DAYS.slice(0, first - 1)];
}

/** Common business weeks; the server's default for the client's country is what an unsaved calendar shows. */
const WEEK_PRESETS: { key: string; open: Day[]; hours: [string, string] }[] = [
  { key: "presetMonFri", open: ["mon", "tue", "wed", "thu", "fri"], hours: ["09:00", "18:00"] },
  { key: "presetSunThu", open: ["sun", "mon", "tue", "wed", "thu"], hours: ["09:00", "18:00"] },
  { key: "presetSatThu", open: ["sat", "sun", "mon", "tue", "wed", "thu"], hours: ["10:00", "19:00"] },
];

export function CalendarEditor({ clientId }: { clientId: string }) {
  const t = useTranslations("sla.calendar");
  const qc = useQueryClient();
  const canManage = useCan("sla.policy.manage");
  const q = useQuery({
    queryKey: clientKeys.calendar(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/calendar", { params: { path: { clientId } } })),
  });
  const [week, setWeek] = useState<Record<string, string[][]>>({});
  const [holidays, setHolidays] = useState<string[]>([]);
  const [tz, setTz] = useState("UTC");
  const [newHoliday, setNewHoliday] = useState("");
  const [source, setSource] = useState<Schemas["HolidaySource"] | null>(null);
  const locale = useLocale();
  const region = usePreferences((p) => p.region);
  // The week starts where the agency's country starts it (Saturday, Sunday or Monday).
  const days = useMemo(
    () => weekOrder(intlLocale({ locale: locale as FormatOptions["locale"], digits: "latn", region })),
    [locale, region],
  );
  const country = useClients().byId.get(clientId)?.country;
  const year = new Date().getFullYear();
  useEffect(() => {
    if (q.data) {
      setWeek(q.data.weekly_hours);
      setHolidays(q.data.holidays);
      setTz(q.data.timezone);
      setSource(q.data.holiday_source);
    }
  }, [q.data]);
  const presets = useMutation({
    mutationFn: () => unwrap(api.GET("/v1/holidays", { params: { query: { country: country!, year } } })),
    onSuccess: (p) => {
      if (!p.supported || p.holidays.length === 0) {
        toast.info(t("holidaysUnsupported"));
        return;
      }
      setHolidays([...new Set([...holidays, ...p.holidays.map((h) => h.date)])].sort());
      setSource({ country: p.country, year: p.year, dataset: p.dataset });
      toast.success(t("holidaysLoaded", { count: p.holidays.length }));
    },
  });
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT("/v1/clients/{clientId}/calendar", {
          params: { path: { clientId } },
          body: { timezone: tz, weekly_hours: week, holidays, holiday_source: source },
        }),
      ),
    onSuccess: (r) => {
      qc.setQueryData(clientKeys.calendar(clientId), r);
      void qc.invalidateQueries({ queryKey: ["sla-preview", clientId] });
      toast.success(t("saved"));
    },
  });
  if (!q.data) return <Skeleton className="h-64 w-full" />;
  const setDay = (d: string, v: string[][]) => setWeek({ ...week, [d]: v });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <span className="text-muted text-sm">{tz}</span>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {WEEK_PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant="secondary"
              disabled={!canManage}
              onClick={() => setWeek(Object.fromEntries(ISO_DAYS.map((d) => [d, p.open.includes(d) ? [p.hours] : []])))}
            >
              {t(p.key)}
            </Button>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={!canManage}
            onClick={() => setWeek(Object.fromEntries(ISO_DAYS.map((d) => [d, [["00:00", "24:00"]]])))}
          >
            {t("preset247")}
          </Button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {days.map((d) => {
              const intervals = week[d] ?? [];
              const open = intervals.length > 0;
              return (
                <tr key={d} className="border-border border-t">
                  <th scope="row" className="w-24 py-2 text-start font-medium">
                    {t(`day.${d}`)}
                  </th>
                  <td className="py-2">
                    <Switch
                      checked={open}
                      disabled={!canManage}
                      onCheckedChange={(v) => setDay(d, v ? [["09:00", "18:00"]] : [])}
                      aria-label={t("openOn", { day: t(`day.${d}`) })}
                    />
                  </td>
                  <td className="py-2">
                    {open ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {intervals.map((iv, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            <Input
                              type="time"
                              className="h-8 w-28"
                              value={iv[0]}
                              disabled={!canManage}
                              aria-label={t("from")}
                              onChange={(e) =>
                                setDay(
                                  d,
                                  intervals.map((x, j) => (j === i ? [e.target.value, x[1] ?? ""] : x)),
                                )
                              }
                            />
                            –
                            <Input
                              type="time"
                              className="h-8 w-28"
                              value={iv[1] === "24:00" ? "23:59" : iv[1]}
                              disabled={!canManage}
                              aria-label={t("to")}
                              onChange={(e) =>
                                setDay(
                                  d,
                                  intervals.map((x, j) => (j === i ? [x[0] ?? "", e.target.value] : x)),
                                )
                              }
                            />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">{t("closed")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{t("holidays")}</p>
            {canManage && country && (
              <Button size="sm" variant="ghost" onClick={() => presets.mutate()} loading={presets.isPending}>
                <CalendarPlus aria-hidden />
                {t("loadHolidays", { country: regionName(locale, country), year })}
              </Button>
            )}
          </div>
          <p className="text-muted text-xs">{t("lunarHint")}</p>
          <div className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <span key={h} className="bg-surface-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs">
                {h}
                {canManage && (
                  <button
                    type="button"
                    aria-label={t("removeHoliday", { date: h })}
                    onClick={() => setHolidays(holidays.filter((x) => x !== h))}
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                )}
              </span>
            ))}
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Input
                type="date"
                className="w-auto"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                aria-label={t("addHoliday")}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newHoliday}
                onClick={() => {
                  setHolidays([...new Set([...holidays, newHoliday])].sort());
                  setNewHoliday("");
                }}
              >
                {t("addHoliday")}
              </Button>
            </div>
          )}
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function regionName(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
