"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, CheckCircle2, MapPin, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { Button } from "@/shared/ui/button";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { Badge, Skeleton } from "@/shared/ui/primitives";

import { apptKeys } from "./api";
import { SlotPicker } from "./parts";

type PublicAppointment = Schemas["PublicAppointment"];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      {children}
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border-border bg-surface shadow-pop relative grid gap-4 overflow-hidden border p-5">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
      {children}
    </div>
  );
}

function Gone({ title }: { title: string }) {
  return (
    <div className="grid justify-items-center gap-3 py-10 text-center">
      <XCircle className="text-danger size-10" aria-hidden />
      <h1 className="font-medium">{title}</h1>
    </div>
  );
}

/** /book/[token]: the lead picks a time. Built for the WhatsApp in-app browser on a cheap phone. */
export function BookPage({ token }: { token: string }) {
  const t = useTranslations("bookPage");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const page = useQuery({
    queryKey: apptKeys.publicBooking(token),
    queryFn: () => unwrap(api.GET("/v1/public/book/{token}", { params: { path: { token } } })),
    retry: false,
  });
  const [start, setStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const book = useMutation({
    mutationFn: (starts_at: string) =>
      unwrap(
        api.POST("/v1/public/book/{token}", { params: { path: { token } }, body: { starts_at, language: locale } }),
      ),
    meta: { silent: true },
    onSuccess: (a) => {
      qc.setQueryData(apptKeys.publicAppt(a.token!), a);
      router.replace(`/appt/${a.token}?booked=1`);
    },
    onError: (e) => {
      setError(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed"));
      setStart(null);
      void page.refetch();
    },
  });
  const p = page.data;
  return (
    <Shell>
      {page.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : !p ? (
        <Gone title={t("notFound")} />
      ) : (
        <Panel>
          <div className="grid gap-1">
            <h1 className="text-lg font-semibold">{t("title", { title: p.title, client: p.client })}</h1>
            {p.first_name && <p className="text-muted text-sm">{t("hello", { name: p.first_name })}</p>}
            <p className="text-muted text-sm">
              {t("duration", { minutes: p.duration_minutes })}
              {p.location && ` · ${p.location}`}
            </p>
          </div>
          <SlotPicker slots={p.slots} timeZone={p.timezone} value={start} onChange={setStart} label={t("pick")} />
          <p className="text-muted text-xs">{t("zone", { zone: p.timezone })}</p>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <Button size="lg" disabled={!start} loading={book.isPending} onClick={() => start && book.mutate(start)}>
            {t("confirm")}
          </Button>
        </Panel>
      )}
    </Shell>
  );
}

/** /appt/[token]: the lead's appointment — confirm, change or cancel. */
export function ApptPage({ token, booked }: { token: string; booked: boolean }) {
  const t = useTranslations("bookPage");
  const ts = useTranslations("appointments.status");
  const te = useTranslations("errors");
  const f = useFormat();
  const router = useRouter();
  const qc = useQueryClient();
  const view = useQuery({
    queryKey: apptKeys.publicAppt(token),
    queryFn: () => unwrap(api.GET("/v1/public/appointments/{token}", { params: { path: { token } } })),
    retry: false,
  });
  const [changing, setChanging] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slots = useQuery({
    queryKey: apptKeys.publicSlots(token),
    queryFn: () => unwrap(api.GET("/v1/public/appointments/{token}/slots", { params: { path: { token } } })),
    enabled: changing,
  });
  const fail = (e: unknown) => setError(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed"));
  const act = useMutation({
    mutationFn: (action: "confirm" | "cancel") =>
      unwrap(
        action === "confirm"
          ? api.POST("/v1/public/appointments/{token}/confirm", { params: { path: { token } } })
          : api.POST("/v1/public/appointments/{token}/cancel", { params: { path: { token } } }),
      ),
    meta: { silent: true },
    onSuccess: (a) => {
      qc.setQueryData(apptKeys.publicAppt(token), a);
      setCancelling(false);
      setError(null);
    },
    onError: fail,
  });
  const move = useMutation({
    mutationFn: (starts_at: string) =>
      unwrap(
        api.POST("/v1/public/appointments/{token}/reschedule", { params: { path: { token } }, body: { starts_at } }),
      ),
    meta: { silent: true },
    onSuccess: (a: PublicAppointment) => {
      qc.setQueryData(apptKeys.publicAppt(a.token!), a);
      router.replace(`/appt/${a.token}?booked=1`);
    },
    onError: (e) => {
      fail(e);
      void slots.refetch();
    },
  });
  const a = view.data;
  if (view.isPending)
    return (
      <Shell>
        <Skeleton className="h-80 w-full" />
      </Shell>
    );
  if (!a)
    return (
      <Shell>
        <Gone title={t("apptNotFound")} />
      </Shell>
    );
  const upcoming = a.status === "booked" || a.status === "confirmed";
  return (
    <Shell>
      <Panel>
        {booked && upcoming && (
          <p className="text-success flex items-center gap-2 text-sm font-medium" role="status">
            <CheckCircle2 className="size-5" aria-hidden />
            {t("bookedBanner")}
          </p>
        )}
        <div className="grid gap-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold">{t("apptTitle", { title: a.title, client: a.client })}</h1>
            <Badge tone={a.status === "cancelled" || a.status === "no_show" ? "neutral" : "success"}>
              {ts(a.status)}
            </Badge>
          </div>
          <p className="flex items-center gap-2 text-base font-medium">
            <CalendarCheck className="text-accent size-5" aria-hidden />
            {f.dateTime(a.starts_at, a.timezone, "datetime")}
          </p>
          {a.location && (
            <p className="text-muted flex items-center gap-2 text-sm">
              <MapPin className="size-4" aria-hidden />
              {a.location}
            </p>
          )}
          <p className="text-muted text-xs">{t("zone", { zone: a.timezone })}</p>
        </div>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        {a.can_change && !changing && !cancelling && (
          <div className="grid gap-2">
            {a.status === "booked" && (
              <Button
                size="lg"
                loading={act.isPending && act.variables === "confirm"}
                onClick={() => act.mutate("confirm")}
              >
                {t("confirmComing")}
              </Button>
            )}
            {a.can_reschedule && (
              <Button size="lg" variant="secondary" onClick={() => setChanging(true)}>
                {t("change")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setCancelling(true)}>
              {t("cancel")}
            </Button>
          </div>
        )}
        {cancelling && (
          <div className="grid gap-2" role="group" aria-label={t("cancelQuestion")}>
            <p className="text-sm font-medium">{t("cancelQuestion")}</p>
            <Button variant="danger" loading={act.isPending} onClick={() => act.mutate("cancel")}>
              <CalendarX aria-hidden />
              {t("cancelYes")}
            </Button>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              {t("keep")}
            </Button>
          </div>
        )}
        {changing && (
          <div className="grid gap-3">
            {slots.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <SlotPicker
                slots={slots.data?.data ?? []}
                timeZone={a.timezone}
                value={start}
                onChange={setStart}
                label={t("pick")}
              />
            )}
            <Button size="lg" disabled={!start} loading={move.isPending} onClick={() => start && move.mutate(start)}>
              {t("moveHere")}
            </Button>
            <Button variant="secondary" onClick={() => setChanging(false)}>
              {t("keep")}
            </Button>
          </div>
        )}
        {a.status === "cancelled" && <p className="text-muted text-sm">{t("cancelledNote")}</p>}
      </Panel>
    </Shell>
  );
}
