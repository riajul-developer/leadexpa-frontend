"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2Off, Search, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@/shared/ui/primitives";

import { conversionKeys, useDisconnectGoogle, useGoogle } from "./api";

const CALLBACK_MESSAGE = "recov-google-callback";

export function GoogleAdsCard() {
  const t = useTranslations("google");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const q = useGoogle();
  const disconnect = useDisconnectGoogle();
  const connect = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/integrations/google/connect")),
    meta: { silent: true },
    onSuccess: ({ authorize_url }) => {
      track("integration.google.connect_started");
      const w = 520;
      const h = 680;
      const popup = window.open(
        authorize_url,
        "recov-google",
        `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`,
      );
      if (!popup) window.location.assign(authorize_url);
    },
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.origin !== window.location.origin || e.data?.type !== CALLBACK_MESSAGE) return;
      toast.success(t("connected"));
      void qc.invalidateQueries({ queryKey: conversionKeys.google });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc, t]);

  if (q.isPending || !q.data) return null;
  const conns = q.data.connections;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Search className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <p className="text-muted text-sm">{q.data.configured ? t("hint") : t("unconfigured")}</p>
          </div>
        </div>
        {q.data.configured && (
          <Button size="sm" variant="secondary" onClick={() => connect.mutate()} loading={connect.isPending}>
            {conns.length ? t("connectAnother") : t("connect")}
          </Button>
        )}
      </CardHeader>
      {conns.length > 0 && (
        <CardContent>
          <ul className="grid gap-2">
            {conns.map((c) => (
              <li key={c.id} className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium" dir="ltr">
                  {c.email}
                </span>
                <Badge tone={c.status === "active" ? "success" : "danger"}>{t(`status.${c.status}`)}</Badge>
                {c.status !== "active" && (
                  <Button size="sm" onClick={() => connect.mutate()}>
                    {t("reconnect")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  loading={disconnect.isPending && disconnect.variables === c.id}
                  onClick={() => window.confirm(t("disconnectConfirm")) && disconnect.mutate(c.id)}
                >
                  <Unplug aria-hidden />
                  {t("disconnect")}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

export function GoogleCallback() {
  const t = useTranslations("google.callback");
  const te = useTranslations("errors");
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const [error, setError] = useState<string | null>(params.get("error") ? t("denied") : null);
  const complete = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/integrations/google/callback", { body: { code: code!, state: state! } })),
    meta: { silent: true },
    onSuccess: () => {
      track("integration.google.connected");
      if (window.opener) {
        (window.opener as Window).postMessage({ type: CALLBACK_MESSAGE }, window.location.origin);
        window.close();
      } else {
        window.location.replace(window.location.pathname.replace(/\/google\/callback$/, ""));
      }
    },
    onError: (e) => setError(isApiError(e) && te.has(e.code) ? te(e.code) : te("google_oauth_failed")),
  });
  const { mutate, isIdle } = complete;
  useEffect(() => {
    if (code && state && isIdle) mutate();
  }, [code, state, isIdle, mutate]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? (
        <>
          <Link2Off className="text-danger size-10" aria-hidden />
          <p className="font-medium">{error}</p>
          <Button variant="secondary" onClick={() => (window.opener ? window.close() : history.back())}>
            {t("close")}
          </Button>
        </>
      ) : (
        <Spinner label={t("connecting")} />
      )}
    </main>
  );
}
