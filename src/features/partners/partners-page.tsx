"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Handshake, MousePointerClick, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConnectCard } from "@/features/reseller";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

export const partnerKeys = { program: ["partner"] as const, activity: ["partner", "activity"] as const };

/** /partners: refer agencies, earn a share of what they pay, get paid to your Stripe account (6c). */
export function PartnersPage() {
  const t = useTranslations("partners");
  const f = useFormat();
  const qc = useQueryClient();
  const program = useQuery({ queryKey: partnerKeys.program, queryFn: () => unwrap(api.GET("/v1/partner")) });
  const join = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/partner")),
    onSuccess: (p) => {
      track("partner.joined");
      qc.setQueryData(partnerKeys.program, p);
      toast.success(t("joined"));
    },
  });
  const p = program.data;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Handshake className="text-accent size-6" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted max-w-2xl text-sm">
          {p ? t("subtitle", { percent: f.number(p.commission_percent), months: p.months }) : null}
        </p>
      </header>

      {!p ? (
        <Skeleton className="h-40 w-full" />
      ) : !p.enrolled ? (
        <Card>
          <CardContent className="grid gap-4 py-6">
            <ul className="grid gap-3 text-sm sm:grid-cols-3">
              {(["share", "earn", "paid"] as const).map((k, i) => (
                <li key={k} className="bg-surface-2 rounded-lg p-3">
                  <span className="text-accent text-xs font-semibold">{i + 1}</span>
                  <p>
                    {t(`how.${k}`, { percent: f.number(p.commission_percent), months: p.months, days: p.hold_days })}
                  </p>
                </li>
              ))}
            </ul>
            <Button className="justify-self-start" loading={join.isPending} onClick={() => join.mutate()}>
              {t("join")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("yourLink")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="bg-surface-2 min-w-0 flex-1 rounded-lg p-3 text-sm break-all" dir="ltr">
                  {p.link}
                </code>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard.writeText(p.link ?? "").then(() => toast.success(t("copied")))
                  }
                >
                  <Copy aria-hidden />
                  {t("copy")}
                </Button>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                <Stat icon={MousePointerClick} label={t("clicks")} value={f.number(p.clicks)} />
                <Stat icon={UserPlus} label={t("signups")} value={f.number(p.signups)} />
                <Stat icon={Users} label={t("active")} value={f.number(p.active_referrals)} />
              </dl>
            </CardContent>
          </Card>
          <BalancesCard balances={p.balances} holdDays={p.hold_days} />
          <ConnectCard account={p.payout_account} purpose="partner" />
          <ActivityCards />
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <dt className="text-muted flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

type Balance = { currency: string; pending_minor: number; available_minor: number; paid_minor: number };

function BalancesCard({ balances, holdDays }: { balances: Balance[]; holdDays: number }) {
  const t = useTranslations("partners.balance");
  const f = useFormat();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {balances.length === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          balances.map((b) => (
            <dl key={b.currency} className="grid grid-cols-3 gap-3" data-currency={b.currency}>
              {(
                [
                  ["pending", b.pending_minor],
                  ["available", b.available_minor],
                  ["paid", b.paid_minor],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className={k === "available" ? "bg-primary-soft rounded-lg p-2" : "p-2"}>
                  <dt className="text-muted text-xs">{t(k)}</dt>
                  <dd
                    className={k === "available" ? "text-primary text-lg font-semibold tabular-nums" : "tabular-nums"}
                  >
                    {f.money({ amount_minor: v, currency: b.currency })}
                  </dd>
                </div>
              ))}
            </dl>
          ))
        )}
        <p className="text-muted text-xs">{t("hint", { days: holdDays })}</p>
      </CardContent>
    </Card>
  );
}

function ActivityCards() {
  const t = useTranslations("partners");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const activity = useQuery({ queryKey: partnerKeys.activity, queryFn: () => unwrap(api.GET("/v1/partner/activity")) });
  const a = activity.data;
  if (!a) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("referrals.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {a.referrals.length === 0 ? (
            <p className="text-muted text-sm">{t("referrals.empty")}</p>
          ) : (
            <ul className="divide-border grid divide-y">
              {a.referrals.map((r) => (
                <li
                  key={r.name + r.created_at}
                  className="flex items-center gap-3 py-2.5 text-sm"
                  data-referral={r.name}
                >
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-muted text-xs">
                      {r.status === "rejected" && r.rejected_reason
                        ? t(`referrals.reason.${r.rejected_reason}`)
                        : t("referrals.until", { when: f.dateTime(r.commission_until, tz, "date") })}
                    </span>
                  </div>
                  {r.status === "rejected" ? (
                    <Badge tone="danger">{t("referrals.rejected")}</Badge>
                  ) : (
                    <Badge tone="success">{t("referrals.activeBadge")}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("ledger.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {a.ledger.length === 0 ? (
            <p className="text-muted text-sm">{t("ledger.empty")}</p>
          ) : (
            <ul className="divide-border grid divide-y">
              {a.ledger.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm" data-kind={l.kind}>
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate">
                      {t(`ledger.kind.${l.kind}`)}
                      {l.referral && <span className="text-muted"> · {l.referral}</span>}
                    </span>
                    <span className="text-muted text-xs">
                      {t(`ledger.status.${l.status}`)}
                      {l.status === "pending" &&
                        ` · ${t("ledger.availableOn", { when: f.dateTime(l.available_at, tz, "date") })}`}
                    </span>
                  </div>
                  <span className={l.amount_minor < 0 ? "text-danger tabular-nums" : "text-success tabular-nums"}>
                    {f.money({ amount_minor: l.amount_minor, currency: l.currency })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {a.payouts.length > 0 && (
            <div className="border-border mt-4 grid gap-2 border-t pt-4">
              <p className="text-sm font-medium">{t("payouts")}</p>
              {a.payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{f.dateTime(p.created_at, tz, "date")}</span>
                  <span className="tabular-nums">
                    {f.money({ amount_minor: p.amount_minor, currency: p.currency })}
                  </span>
                  <Badge tone={p.status === "paid" ? "success" : "danger"}>{t(`payoutStatus.${p.status}`)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
