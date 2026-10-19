"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Link2Off } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, Spinner } from "@/shared/ui/primitives";

import { apptKeys, useConnectCalendar, useDisconnectCalendar, useMyCalendar } from "./api";

const PROVIDERS = ["google", "microsoft"] as const;
// The provider's callback URL is English-only; this restores the member's locale.
const RETURN_LOCALE = "calendar-return-locale";

export function CalendarSettings() {
  const t = useTranslations("appointments.calendar");
  const te = useTranslations("errors");
  const locale = useLocale();
  const cal = useMyCalendar();
  const connect = useConnectCalendar();
  const disconnect = useDisconnectCalendar();
  const c = cal.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
        {c?.connected &&
          (c.status === "error" ? (
            <Badge tone="danger">{t("broken")}</Badge>
          ) : (
            <Badge tone="success">{t("connected")}</Badge>
          ))}
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted text-sm">{t("hint")}</p>
        {!c ? (
          <Skeleton className="h-16 w-full" />
        ) : c.connected ? (
          <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="font-medium">{t(`provider.${c.provider ?? "google"}`)}</span>
            <span className="text-muted" dir="ltr">
              {c.email}
            </span>
            {c.status === "error" && <span className="text-danger w-full text-xs">{t("brokenHint")}</span>}
            <Button
              className="ms-auto"
              size="sm"
              variant="secondary"
              loading={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast.success(t("disconnected")) })}
            >
              {t("disconnect")}
            </Button>
          </div>
        ) : c.available.length === 0 ? (
          <p className="text-muted text-sm">{t("unavailable")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.filter((p) => c.available.includes(p)).map((p) => (
              <Button
                key={p}
                variant="secondary"
                loading={connect.isPending && connect.variables === p}
                onClick={() => {
                  try {
                    sessionStorage.setItem(RETURN_LOCALE, locale);
                  } catch {
                    // private mode: the callback stays in English
                  }
                  connect.mutate(p, {
                    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed")),
                  });
                }}
              >
                {t("connect", { provider: t(`provider.${p}`) })}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CalendarCallback() {
  const t = useTranslations("appointments.calendar");
  const te = useTranslations("errors");
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const code = params.get("code");
  const state = params.get("state");
  const [error, setError] = useState<string | null>(params.get("error") ? t("denied") : null);
  const complete = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/me/calendar/callback", { body: { code: code!, state: state! } })),
    meta: { silent: true },
    onSuccess: (c) => {
      track("calendar.connected", { provider: c.provider });
      qc.setQueryData(apptKeys.calendar, c);
      toast.success(t("connectedToast"));
      back();
    },
    onError: (e) => setError(isApiError(e) && te.has(e.code) ? te(e.code) : te("calendar_oauth_failed")),
  });
  const { mutate, isIdle } = complete;
  function back() {
    let locale: string | null = null;
    try {
      locale = sessionStorage.getItem(RETURN_LOCALE);
      sessionStorage.removeItem(RETURN_LOCALE);
    } catch {
      // stay in this locale
    }
    router.replace("/settings/calendar", locale && routing.locales.includes(locale as never) ? { locale } : undefined);
  }
  useEffect(() => {
    if (code && state && isIdle) mutate();
  }, [code, state, isIdle, mutate]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? (
        <>
          <Link2Off className="text-danger size-10" aria-hidden />
          <p className="font-medium">{error}</p>
          <Button variant="secondary" onClick={back}>
            {t("back")}
          </Button>
        </>
      ) : (
        <Spinner label={t("connecting")} />
      )}
    </main>
  );
}
