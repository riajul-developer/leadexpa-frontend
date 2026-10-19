"use client";

import { CalendarCheck, CalendarClock, CalendarPlus, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import type { Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { NativeSelect, Textarea } from "@/shared/ui/input";
import { Dialog, DialogContent } from "@/shared/ui/overlays";
import { Card, Skeleton } from "@/shared/ui/primitives";

import {
  type Appointment,
  useBook,
  useBookingLink,
  useCancelAppointment,
  useLeadAppointments,
  useLeadSlots,
  useOutcome,
  useReschedule,
} from "./api";
import { AppointmentStatusBadge, RiskBadge, SlotPicker } from "./parts";

type Lead = Schemas["LeadDetail"];
const LANGUAGES = ["en", "bn", "ar"] as const;

export function LeadAppointments({ lead, timeZone }: { lead: Lead; timeZone: string }) {
  const t = useTranslations("appointments.lead");
  const te = useTranslations("errors");
  const f = useFormat();
  const canUpdate = useCan("lead.update");
  const list = useLeadAppointments(lead.id);
  const link = useBookingLink(lead.id);
  const cancel = useCancelAppointment(lead.id);
  const outcome = useOutcome(lead.id);
  const [dialog, setDialog] = useState<{ mode: "book" } | { mode: "move"; appt: Appointment } | null>(null);
  const rows = list.data?.data ?? [];
  const now = Date.now();
  const fail = (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed"));
  const copyLink = () =>
    link.mutate(undefined, {
      onSuccess: async ({ url }) => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("linkCopied"));
        } catch {
          toast.success(url);
        }
      },
      onError: fail,
    });
  return (
    <Card className="grid gap-3 p-3" data-testid="lead-appointments">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="text-accent size-4" aria-hidden />
          {t("title")}
        </h3>
        {canUpdate && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={link.isPending} onClick={copyLink}>
              <Link2 aria-hidden />
              {t("link")}
            </Button>
            <Button size="sm" onClick={() => setDialog({ mode: "book" })}>
              <CalendarPlus aria-hidden />
              {t("book")}
            </Button>
          </div>
        )}
      </div>
      {list.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">{t("none")}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((a) => {
            const upcoming = (a.status === "booked" || a.status === "confirmed") && Date.parse(a.starts_at) > now;
            const started = (a.status === "booked" || a.status === "confirmed") && Date.parse(a.starts_at) <= now;
            return (
              <li
                key={a.id}
                data-appointment={a.id}
                className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                <span className="font-semibold">{f.dateTime(a.starts_at, timeZone, "short")}</span>
                <span className="text-muted">{a.title}</span>
                <AppointmentStatusBadge status={a.status} />
                <RiskBadge appt={a} />
                <span className="text-muted ms-auto text-xs">
                  {t(`source.${a.source}`)}
                  {a.on_calendar && ` · ${t("onCalendar")}`}
                </span>
                {canUpdate && upcoming && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ mode: "move", appt: a })}>
                      <CalendarClock aria-hidden />
                      {t("move")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={cancel.isPending && cancel.variables === a.id}
                      onClick={() =>
                        cancel.mutate(a.id, { onSuccess: () => toast.success(t("cancelled")), onError: fail })
                      }
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                )}
                {canUpdate && started && (
                  <div className="flex w-full gap-2 sm:w-auto" role="group" aria-label={t("outcomeLabel")}>
                    {(["attended", "no_show"] as const).map((o) => (
                      <Button
                        key={o}
                        size="sm"
                        variant={o === "attended" ? "primary" : "secondary"}
                        loading={outcome.isPending && outcome.variables?.id === a.id && outcome.variables.outcome === o}
                        onClick={() => outcome.mutate({ id: a.id, outcome: o }, { onError: fail })}
                      >
                        {t(`outcome.${o}`)}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {dialog && (
        <BookDialog
          lead={lead}
          moving={dialog.mode === "move" ? dialog.appt : null}
          onClose={() => setDialog(null)}
          onError={fail}
        />
      )}
    </Card>
  );
}

function BookDialog({
  lead,
  moving,
  onClose,
  onError,
}: {
  lead: Lead;
  moving: Appointment | null;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const t = useTranslations("appointments.lead");
  const tl = useTranslations("appointments.language");
  const f = useFormat();
  const locale = useLocale();
  const slots = useLeadSlots(lead.id, true);
  const book = useBook(lead.id);
  const move = useReschedule(lead.id);
  const [start, setStart] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState(
    moving?.language ?? (LANGUAGES.includes(locale as (typeof LANGUAGES)[number]) ? locale : "en"),
  );
  const av = slots.data;
  const submit = () => {
    if (!start) return;
    const done = {
      onSuccess: (a: Appointment) => {
        toast.success(
          t(moving ? "moved" : "booked", { when: f.dateTime(a.starts_at, av?.timezone ?? "UTC", "short") }),
        );
        onClose();
      },
      onError,
    };
    if (moving) move.mutate({ id: moving.id, starts_at: start }, done);
    else book.mutate({ starts_at: start, notes: notes.trim() || undefined, language }, done);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={moving ? t("moveTitle") : t("bookTitle", { name: lead.full_name || t("thisLead") })}
        description={av ? t("hint", { title: av.title, minutes: av.duration_minutes, zone: av.timezone }) : undefined}
      >
        {slots.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : !av?.enabled ? (
          <p className="text-muted text-sm">{t("disabled")}</p>
        ) : (
          <div className="grid gap-4">
            <SlotPicker slots={av.slots} timeZone={av.timezone} value={start} onChange={setStart} label={t("time")} />
            {!moving && (
              <>
                <Field label={t("language")} hint={t("languageHint")}>
                  <NativeSelect value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {tl(l)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t("notes")}>
                  <Textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t("close")}
          </Button>
          <Button disabled={!start} loading={book.isPending || move.isPending} onClick={submit}>
            {moving ? t("confirmMove") : t("confirmBook")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
