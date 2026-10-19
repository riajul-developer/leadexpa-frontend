"use client";

import { CheckCircle2, Lock, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { BrandMark } from "@/shared/ui/brand";
import { Button } from "@/shared/ui/button";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { Skeleton } from "@/shared/ui/primitives";

import { useBuyCheckout, useBuyView } from "./api";

export function BuyPage({ code }: { code: string }) {
  const t = useTranslations("buyPage");
  const te = useTranslations("errors");
  const f = useFormat();
  const done = useSearchParams().get("done") === "1";
  const view = useBuyView(code);
  const checkout = useBuyCheckout(code);
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
        <Message icon={XCircle} tone="text-danger" title={t("notFound")} />
      ) : (
        <div className="rounded-card border-border bg-surface shadow-pop relative overflow-hidden border p-5">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
          <p className="text-muted text-sm">{v.agency}</p>
          <h1 className="text-xl font-semibold">{v.plan}</h1>
          {v.description && <p className="text-muted mt-1 text-sm">{v.description}</p>}
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {f.money({ amount_minor: v.amount_minor, currency: v.currency })}
            <span className="text-muted text-base font-normal">
              {" "}
              {v.interval === "month" ? t("perMonth") : v.interval === "year" ? t("perYear") : ""}
            </span>
          </p>
          <div className="mt-6">
            {done ? (
              <Message
                icon={CheckCircle2}
                tone="text-success"
                title={t("thanks")}
                body={t("thanksHint", { agency: v.agency })}
              />
            ) : !v.available ? (
              <Message
                icon={XCircle}
                tone="text-muted"
                title={t("unavailable")}
                body={t("unavailableHint", { agency: v.agency })}
              />
            ) : (
              <div className="grid gap-3">
                <Button size="lg" loading={checkout.isPending} onClick={() => checkout.mutate()}>
                  {v.interval ? t("subscribe") : t("buy")}
                </Button>
                {checkout.isError && (
                  <p className="text-danger text-sm" role="alert">
                    {isApiError(checkout.error) && te.has(checkout.error.code)
                      ? te(checkout.error.code)
                      : t("tryAgain")}
                  </p>
                )}
                <p className="text-muted text-center text-xs">{t("paysAgency", { agency: v.agency })}</p>
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
