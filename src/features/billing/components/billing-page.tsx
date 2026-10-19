"use client";

import { Check, CreditCard, ExternalLink, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Progress, Tabs, TabsList, TabsTrigger } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import {
  type Interval,
  type PaidPlan,
  type Subscription,
  useBillingSummary,
  useChangePlan,
  useCheckout,
  usePortal,
  usePrices,
} from "../api";

import { InvoicesCard } from "./invoices-card";
import { UsageCard } from "./usage-card";

const PAID: readonly string[] = ["starter", "growth", "pro"];
const LIVE = new Set(["trialing", "active", "past_due"]);

export function BillingPage() {
  const t = useTranslations("billing");
  const f = useFormat();
  const now = useNow();
  const tz = useDisplayTimeZone();
  const canManage = useCan("billing.manage");
  const summary = useBillingSummary();
  const prices = usePrices();
  const checkout = useCheckout();
  const change = useChangePlan();
  const portal = usePortal();
  const [interval, setInterval] = useState<Interval>("month");
  const s = summary.data;
  const sub = s?.subscription ?? null;
  const live = !!sub && LIVE.has(sub.status);

  useCheckoutReturn();
  useEffect(() => {
    if (sub?.interval === "year") setInterval("year");
  }, [sub?.interval]);

  function choose(plan: PaidPlan) {
    if (live) {
      change.mutate(
        { plan, interval },
        { onSuccess: () => toast.success(t("checkout.changed", { plan: planName(plan) })) },
      );
    } else checkout.mutate({ plan, interval });
  }
  const planName = (code: string) => prices.data?.plans.find((p) => p.code === code)?.name ?? code;

  return (
    <div className="grid gap-4">
      {sub?.status === "past_due" && <PastDueBanner sub={sub} plan={s?.plan.name ?? ""} />}

      <Card>
        <CardHeader>
          <CardTitle>{t("current")}</CardTitle>
          {s?.trial_expired && <Badge tone="danger">{t("trialExpired")}</Badge>}
          {sub && <SubscriptionBadge status={sub.status} />}
        </CardHeader>
        <CardContent className="grid gap-4">
          {!s ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold">{s.plan.name}</p>
                  {s.assigned_plan === "trial" && s.trial_ends_at && !s.trial_expired && (
                    <p className="text-muted text-sm">
                      {t("trialEnds", { when: f.relative(s.trial_ends_at, now || Date.now()) })}
                    </p>
                  )}
                  {sub && live && sub.amount_minor != null && sub.currency && (
                    <p className="text-muted text-sm">
                      {f.money({ amount_minor: sub.amount_minor, currency: sub.currency })}{" "}
                      {sub.interval === "year" ? t("perYear") : t("perMonth")}
                      {sub.current_period_end &&
                        " · " +
                          (sub.cancel_at_period_end
                            ? t("subscription.ends", { when: f.dateTime(sub.current_period_end, tz, "date") })
                            : t("subscription.renews", { when: f.dateTime(sub.current_period_end, tz, "date") }))}
                    </p>
                  )}
                </div>
                {canManage && sub && (
                  <Button variant="secondary" loading={portal.isPending} onClick={() => portal.mutate()}>
                    <CreditCard aria-hidden />
                    {t("subscription.manage")}
                  </Button>
                )}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {s.usage.map((u) => {
                  const pct = u.max > 0 ? (u.used / u.max) * 100 : u.used > 0 ? 100 : 0;
                  return (
                    <li key={u.limit} className="grid gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{t(`limits.${u.limit}`)}</span>
                        <span className="text-muted tabular-nums">
                          {f.number(u.used)} / {f.number(u.max)}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "primary"}
                        label={t(`limits.${u.limit}`)}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="plans-heading" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="plans-heading" className="text-lg font-semibold">
              {t("checkout.title")}
            </h2>
            {prices.data && <p className="text-muted text-sm">{t(`checkout.tax.${prices.data.tax_note}`)}</p>}
          </div>
          <Tabs value={interval} onValueChange={(v) => setInterval(v as Interval)}>
            <TabsList aria-label={t("checkout.interval")}>
              <TabsTrigger value="month">{t("checkout.monthly")}</TabsTrigger>
              <TabsTrigger value="year">
                {t("checkout.annual")}
                <Badge tone="success" className="ms-1">
                  {t("checkout.annualSave")}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {prices.data && !prices.data.checkout_online && canManage && (
          <p className="text-muted text-sm">{t("checkout.offline")}</p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {!prices.data
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-72 w-full" />)
            : prices.data.plans.map((p) => {
                const current = p.code === s?.plan.code && (!live || sub?.interval === interval);
                const amount = interval === "year" ? p.annual_minor : p.monthly_minor;
                const pending =
                  (checkout.isPending && checkout.variables?.plan === p.code) ||
                  (change.isPending && change.variables?.plan === p.code);
                return (
                  <Card key={p.code} className={current ? "border-primary" : undefined} data-plan={p.code}>
                    <CardHeader>
                      <CardTitle>{p.name}</CardTitle>
                      {current && <Badge tone="primary">{t("yourPlan")}</Badge>}
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <p className="text-xl font-semibold">
                        {f.money({ amount_minor: amount, currency: prices.data.currency })}
                        <span className="text-muted text-sm font-normal">
                          {" "}
                          {interval === "year" ? t("perYear") : t("perMonth")}
                        </span>
                      </p>
                      <ul className="grid gap-1 text-sm">
                        {Object.entries(p.limits).map(([k, v]) => (
                          <li key={k} className="flex gap-2">
                            <Check className="text-success size-4 shrink-0" aria-hidden />
                            {t(`limits.${k}`)}: {f.number(v)}
                          </li>
                        ))}
                        {p.features.map((feat) => (
                          <li key={feat} className="flex gap-2">
                            <Check className="text-success size-4 shrink-0" aria-hidden />
                            {t(`feature.${feat}`)}
                          </li>
                        ))}
                      </ul>
                      {!current &&
                        canManage &&
                        PAID.includes(p.code) &&
                        (prices.data.checkout_online ? (
                          <Button
                            variant={p.code === "growth" ? "primary" : "secondary"}
                            loading={pending}
                            disabled={checkout.isPending || change.isPending}
                            onClick={() => choose(p.code as PaidPlan)}
                          >
                            {live ? t("checkout.switch", { plan: p.name }) : t("checkout.choose", { plan: p.name })}
                          </Button>
                        ) : (
                          <Button variant="secondary" asChild>
                            <a href={`mailto:sales@leadexpa.com?subject=${encodeURIComponent("Upgrade to " + p.name)}`}>
                              {t("limit.contact")}
                            </a>
                          </Button>
                        ))}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </section>

      <UsageCard canManage={canManage} />
      {sub && <InvoicesCard />}
    </div>
  );
}

function useCheckoutReturn() {
  const t = useTranslations("billing.checkout");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const outcome = params.get("checkout");
  useEffect(() => {
    if (outcome === "success") toast.success(t("success"));
    else if (outcome === "cancelled") toast.info(t("cancelled"));
    else return;
    router.replace(pathname);
  }, [outcome, t, router, pathname]);
}

function SubscriptionBadge({ status }: { status: Subscription["status"] }) {
  const t = useTranslations("billing.subscription.status");
  const tone =
    status === "active" ? "success" : status === "trialing" ? "info" : status === "past_due" ? "warning" : "neutral";
  return <Badge tone={tone}>{t(status)}</Badge>;
}

function PastDueBanner({ sub, plan }: { sub: Subscription; plan: string }) {
  const t = useTranslations("billing.subscription");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const canManage = useCan("billing.manage");
  const portal = usePortal();
  return (
    <div
      role="alert"
      className="border-warning/40 bg-warning-soft flex flex-wrap items-start gap-3 rounded-xl border p-4"
    >
      <TriangleAlert className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="grid flex-1 gap-1 text-sm">
        <p className="font-medium">{t("pastDueTitle")}</p>
        <p>
          {sub.grace_until
            ? t("pastDue", { plan, when: f.dateTime(sub.grace_until, tz, "date") })
            : t("pastDueNoDate", { plan })}
        </p>
      </div>
      {canManage && (
        <Button size="sm" loading={portal.isPending} onClick={() => portal.mutate()}>
          <ExternalLink aria-hidden />
          {t("updateCard")}
        </Button>
      )}
    </div>
  );
}
