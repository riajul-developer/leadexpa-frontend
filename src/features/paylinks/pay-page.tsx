"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Lock, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { BrandMark } from "@/shared/ui/brand";
import { Button } from "@/shared/ui/button";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { Badge, Skeleton } from "@/shared/ui/primitives";

import { payKeys } from "./api";
import { providerName } from "./parts";

export function PayPage({ token }: { token: string }) {
  const t = useTranslations("payPage");
  const te = useTranslations("errors");
  const f = useFormat();
  const returned = useSearchParams().get("returned") === "1";
  const view = useQuery({
    queryKey: payKeys.public(token),
    queryFn: () => unwrap(api.GET("/v1/public/pay/{token}", { params: { path: { token } } })),
    // Back from the gateway but not confirmed yet: keep checking for a minute.
    refetchInterval: (q) =>
      returned && q.state.data?.status === "opened" && q.state.dataUpdateCount < 12 ? 5000 : false,
    retry: false,
  });
  const start = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/public/pay/{token}/start", { params: { path: { token } } })),
    meta: { silent: true },
    onSuccess: ({ redirect_url }) => window.location.assign(redirect_url),
  });

  const v = view.data;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <span className="text-muted flex items-center gap-1.5 text-xs">
          <Lock className="size-3.5" aria-hidden />
          {t("secure")}
        </span>
        <LocaleSwitcher />
      </div>
      {view.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : !v ? (
        <>
          <h1 className="sr-only">{t("title")}</h1>
          <Message icon={XCircle} tone="text-danger" title={t("notFound")} />
        </>
      ) : (
        <div className="rounded-card border-border bg-surface shadow-pop relative overflow-hidden border p-5">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
          <h1 className="text-lg font-semibold">{v.client_name}</h1>
          {v.first_name && <p className="text-muted text-sm">{t("hello", { name: v.first_name })}</p>}
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {f.money({ amount_minor: v.amount_minor, currency: v.currency })}
          </p>
          <p className="text-muted mt-1 text-sm">
            {t(`purpose.${v.purpose}`)}
            {v.note && ` · ${v.note}`}
          </p>
          {v.sandbox && (
            <Badge tone="warning" className="mt-2">
              {t("sandbox")}
            </Badge>
          )}

          <div className="mt-6">
            {v.status === "paid" || v.status === "refunded" ? (
              <Message
                icon={CheckCircle2}
                tone="text-success"
                title={t("paid")}
                body={t("paidHint", { client: v.client_name })}
              />
            ) : v.status === "expired" || v.status === "cancelled" ? (
              <Message
                icon={Clock}
                tone="text-muted"
                title={t(v.status)}
                body={t("askAgain", { client: v.client_name })}
              />
            ) : returned && v.status === "opened" ? (
              <Message icon={Clock} tone="text-accent" title={t("checking")} body={t("checkingHint")} />
            ) : (
              <div className="grid gap-3">
                {v.status === "failed" && (
                  <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm" role="status">
                    {t("failed")}
                  </p>
                )}
                <Button size="lg" loading={start.isPending} onClick={() => start.mutate()}>
                  {t("pay", { provider: providerName(v.provider) })}
                </Button>
                {start.isError && (
                  <p className="text-danger text-sm" role="alert">
                    {isApiError(start.error) && te.has(start.error.code) ? te(start.error.code) : t("tryAgain")}
                  </p>
                )}
                <p className="text-muted text-center text-xs">
                  {t("expires", { when: f.relative(v.expires_at, Date.now()) })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-muted mt-auto flex items-center justify-center gap-2 text-xs">
        <BrandMark className="size-5" />
        {t("poweredBy")}
      </p>
    </main>
  );
}

function Message({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: typeof CheckCircle2;
  tone: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="grid justify-items-center gap-2 py-4 text-center" role="status">
      <Icon className={`size-12 ${tone}`} aria-hidden />
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="text-muted text-sm">{body}</p>}
    </div>
  );
}
