"use client";

import { CalendarRange, DoorOpen, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { isApiError } from "@/shared/lib/api/errors";
import { useMembers } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Checkbox, Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import {
  type Booking,
  type BookingHours,
  type BookingInput,
  WEEKDAYS,
  useAddResource,
  useBooking,
  useSaveBooking,
  useToggleResource,
} from "./api";

const REMINDERS = [1440, 120, 60, 30] as const;

const toInput = (b: Booking): BookingInput => ({
  enabled: b.enabled,
  title: b.title,
  duration_minutes: b.duration_minutes,
  buffer_minutes: b.buffer_minutes,
  min_notice_minutes: b.min_notice_minutes,
  horizon_days: b.horizon_days,
  max_per_day: b.max_per_day ?? null,
  assignment: b.assignment,
  hours: b.hours,
  location: b.location,
  self_booking: b.self_booking,
  reminder_minutes: b.reminder_minutes,
  confirm_high_risk: b.confirm_high_risk,
  reminder_template: b.reminder_template ?? null,
  reminder_template_language: b.reminder_template_language ?? null,
  hosts: b.hosts,
});

/** Client › Booking (10.1): the rules slots are computed from, who takes appointments, rooms, reminders. */
export function BookingSettings({ clientId }: { clientId: string }) {
  const booking = useBooking(clientId);
  if (!booking.data) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="grid gap-4">
      <RulesCard clientId={clientId} booking={booking.data} />
      <ResourcesCard clientId={clientId} booking={booking.data} />
    </div>
  );
}

function RulesCard({ clientId, booking }: { clientId: string; booking: Booking }) {
  const t = useTranslations("appointments.settings");
  const tw = useTranslations("appointments.weekday");
  const te = useTranslations("errors");
  const canManage = useCan("client.manage");
  const save = useSaveBooking(clientId);
  const { members } = useMembers();
  const [v, setV] = useState<BookingInput>(() => toInput(booking));
  useEffect(() => setV(toInput(booking)), [booking]);
  const set = <K extends keyof BookingInput>(k: K, value: BookingInput[K]) => setV((x) => ({ ...x, [k]: value }));
  const num = (k: keyof BookingInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, Number(e.target.value) as never);
  const setDay = (d: string, w: BookingHours[string] | null) => {
    const hours = { ...v.hours };
    if (w) hours[d] = w;
    else delete hours[d];
    set("hours", hours);
  };
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v.enabled && v.hosts.length === 0) {
      toast.error(t("needHost"));
      return;
    }
    save.mutate(v, {
      onSuccess: () => toast.success(t("saved")),
      onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : t("failed")),
    });
  };
  const active = members.filter((m) => m.status === "active");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
        {booking.enabled ? <Badge tone="success">{t("on")}</Badge> : <Badge>{t("off")}</Badge>}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              {t("enabled")}
              <Switch checked={v.enabled} onCheckedChange={(c) => set("enabled", c)} aria-label={t("enabled")} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("name")}>
                <Input required maxLength={80} value={v.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label={t("location")} hint={t("locationHint")}>
                <Input maxLength={300} value={v.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
              <Field label={t("duration")}>
                <Input type="number" min={5} max={480} value={v.duration_minutes} onChange={num("duration_minutes")} />
              </Field>
              <Field label={t("buffer")} hint={t("bufferHint")}>
                <Input type="number" min={0} max={240} value={v.buffer_minutes} onChange={num("buffer_minutes")} />
              </Field>
              <Field label={t("notice")} hint={t("noticeHint")}>
                <Input
                  type="number"
                  min={0}
                  max={20160}
                  value={v.min_notice_minutes}
                  onChange={num("min_notice_minutes")}
                />
              </Field>
              <Field label={t("horizon")}>
                <Input type="number" min={1} max={120} value={v.horizon_days} onChange={num("horizon_days")} />
              </Field>
              <Field label={t("maxPerDay")} hint={t("maxPerDayHint")}>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={v.max_per_day ?? ""}
                  onChange={(e) => set("max_per_day", e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label={t("assignment")}>
                <NativeSelect
                  value={v.assignment}
                  onChange={(e) => set("assignment", e.target.value as BookingInput["assignment"])}
                >
                  <option value="owner_first">{t("ownerFirst")}</option>
                  <option value="round_robin">{t("roundRobin")}</option>
                </NativeSelect>
              </Field>
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("hours")}</legend>
              {WEEKDAYS.map((d) => {
                const w = v.hours[d]?.[0];
                return (
                  <div key={d} className="flex flex-wrap items-center gap-2" data-day={d}>
                    <label className="flex w-28 items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!w}
                        onCheckedChange={(c) => setDay(d, c ? [{ from: "10:00", to: "18:00" }] : null)}
                      />
                      {tw(d)}
                    </label>
                    {w ? (
                      <>
                        <Input
                          type="time"
                          className="w-32"
                          aria-label={t("from", { day: tw(d) })}
                          value={w.from}
                          onChange={(e) => setDay(d, [{ ...w, from: e.target.value }])}
                        />
                        <span aria-hidden>–</span>
                        <Input
                          type="time"
                          className="w-32"
                          aria-label={t("to", { day: tw(d) })}
                          value={w.to}
                          onChange={(e) => setDay(d, [{ ...w, to: e.target.value }])}
                        />
                      </>
                    ) : (
                      <span className="text-muted text-sm">{t("closed")}</span>
                    )}
                  </div>
                );
              })}
              <p className="text-muted text-xs">{t("zone", { zone: booking.timezone })}</p>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("hosts")}</legend>
              <p className="text-muted text-xs">{t("hostsHint")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {active.map((m) => (
                  <label key={m.user.id} className="flex items-center gap-2 text-sm" data-host={m.user.id}>
                    <Checkbox
                      checked={v.hosts.includes(m.user.id)}
                      onCheckedChange={() => set("hosts", toggle(v.hosts, m.user.id))}
                    />
                    {m.user.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("reminders")}</legend>
              <div className="flex flex-wrap gap-3">
                {REMINDERS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={v.reminder_minutes.includes(m)}
                      onCheckedChange={() => set("reminder_minutes", toggle(v.reminder_minutes, m))}
                    />
                    {t(`before.${m}`)}
                  </label>
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                {t("confirmHighRisk")}
                <Switch
                  checked={v.confirm_high_risk}
                  onCheckedChange={(c) => set("confirm_high_risk", c)}
                  aria-label={t("confirmHighRisk")}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("template")} hint={t("templateHint")}>
                  <Input
                    maxLength={512}
                    value={v.reminder_template ?? ""}
                    onChange={(e) => set("reminder_template", e.target.value || null)}
                  />
                </Field>
                <Field label={t("templateLanguage")}>
                  <Input
                    maxLength={20}
                    value={v.reminder_template_language ?? ""}
                    onChange={(e) => set("reminder_template_language", e.target.value || null)}
                  />
                </Field>
              </div>
            </fieldset>

            <label className="flex items-center justify-between gap-3 text-sm">
              {t("selfBooking")}
              <Switch
                checked={v.self_booking}
                onCheckedChange={(c) => set("self_booking", c)}
                aria-label={t("selfBooking")}
              />
            </label>
          </fieldset>
          {canManage && (
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending}>
                {t("save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

const KINDS = ["room", "vehicle", "equipment", "other"] as const;

function ResourcesCard({ clientId, booking }: { clientId: string; booking: Booking }) {
  const t = useTranslations("appointments.resources");
  const canManage = useCan("client.manage");
  const add = useAddResource(clientId);
  const toggle = useToggleResource(clientId);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("room");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DoorOpen className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted text-sm">{t("hint")}</p>
        {booking.resources.length > 0 && (
          <ul className="grid gap-2">
            {booking.resources.map((r) => (
              <li key={r.id} className="border-border flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted">{t(`kind.${r.kind}`)}</span>
                <span className="ms-auto" />
                <Switch
                  checked={r.active}
                  disabled={!canManage}
                  aria-label={t("active", { name: r.name })}
                  onCheckedChange={(c) => toggle.mutate({ id: r.id, active: c })}
                />
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              add.mutate({ name: name.trim(), kind }, { onSuccess: () => setName("") });
            }}
          >
            <Field label={t("name")} className="min-w-40 flex-1">
              <Input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("kindLabel")}>
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kind.${k}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="secondary" loading={add.isPending}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
