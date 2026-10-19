"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Copy, Link2, Plus, ShoppingBag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { useAgencyCurrency, useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { MoneyInput } from "@/shared/ui/money-input";
import { Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import {
  type ResellerPlan,
  resellerKeys,
  useConnectedAccount,
  useCreateLink,
  useCreatePlan,
  useResellerLinks,
  useResellerOverview,
  useResellerPayouts,
  useResellerPlans,
  useSetLinkStatus,
  useSetPlanActive,
} from "./api";
import { ConnectCard } from "./connect-card";

export function ResellerPage() {
  const t = useTranslations("reseller");
  const account = useConnectedAccount();
  const ready = account.data?.status === "active";
  useOnboardingReturn();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShoppingBag className="text-accent size-6" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted max-w-2xl text-sm">{t("subtitle")}</p>
      </header>
      <ConnectCard account={account.data} purpose="reseller" />
      {account.data?.connected && <EarningsCard />}
      <PlansCard ready={ready} />
      <LinksCard ready={ready} />
      {account.data?.connected && <CustomersCard />}
      {account.data?.payouts_enabled && <PayoutsCard />}
    </div>
  );
}

function useOnboardingReturn() {
  const t = useTranslations("reseller.account");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const outcome = params.get("onboarding");
  useEffect(() => {
    if (!outcome) return;
    if (outcome === "done") toast.success(t("returned"));
    void qc.invalidateQueries({ queryKey: resellerKeys.account });
    router.replace(pathname);
  }, [outcome, t, router, pathname, qc]);
}

function EarningsCard() {
  const t = useTranslations("reseller.earnings");
  const f = useFormat();
  const overview = useResellerOverview();
  const rows = overview.data?.earnings ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!overview.data ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          rows.map((e) => (
            <dl key={e.currency} className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-currency={e.currency}>
              {(
                [
                  ["gross", e.gross_minor],
                  ["fees", e.fees_minor],
                  ["refunds", e.refunds_minor],
                  ["disputes", e.disputes_minor],
                  ["net", e.net_minor],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className={k === "net" ? "bg-primary-soft rounded-lg p-2" : "p-2"}>
                  <dt className="text-muted text-xs">{t(k)}</dt>
                  <dd className={k === "net" ? "text-primary text-lg font-semibold tabular-nums" : "tabular-nums"}>
                    {f.money({ amount_minor: v, currency: e.currency })}
                  </dd>
                </div>
              ))}
            </dl>
          ))
        )}
        <p className="text-muted text-xs">{t("direct")}</p>
      </CardContent>
    </Card>
  );
}

function IntervalLabel({ interval }: { interval: string | null }) {
  const t = useTranslations("reseller.plans");
  return <>{interval === "month" ? t("perMonth") : interval === "year" ? t("perYear") : t("once")}</>;
}

function PlansCard({ ready }: { ready: boolean }) {
  const t = useTranslations("reseller.plans");
  const f = useFormat();
  const plans = useResellerPlans();
  const setActive = useSetPlanActive();
  const [creating, setCreating] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <Button size="sm" disabled={!ready} onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </CardHeader>
      <CardContent>
        {!plans.data ? (
          <Skeleton className="h-16 w-full" />
        ) : plans.data.data.length === 0 ? (
          <p className="text-muted text-sm">{ready ? t("empty") : t("connectFirst")}</p>
        ) : (
          <ul className="divide-border grid divide-y">
            {plans.data.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3" data-plan={p.name}>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{p.name}</span>
                  {p.description && <span className="text-muted truncate text-xs">{p.description}</span>}
                </div>
                <span className="tabular-nums">
                  {f.money({ amount_minor: p.amount_minor, currency: p.currency })}{" "}
                  <span className="text-muted text-xs">
                    <IntervalLabel interval={p.interval} />
                  </span>
                </span>
                {!p.active && <Badge>{t("archived")}</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActive.mutate({ id: p.id, active: !p.active })}
                  aria-label={p.active ? t("archive", { name: p.name }) : t("restore", { name: p.name })}
                >
                  {p.active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {creating && <PlanDialog onClose={() => setCreating(false)} />}
    </Card>
  );
}

function PlanDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("reseller.plans");
  const te = useTranslations("errors");
  const account = useConnectedAccount();
  const agencyCurrency = useAgencyCurrency();
  const create = useCreatePlan();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState(account.data?.default_currency ?? agencyCurrency);
  const [amountText, setAmountText] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [interval, setInterval] = useState<"month" | "year" | "">("month");
  const valid = name.trim() !== "" && amount != null && amount > 0 && /^[A-Z]{3}$/.test(currency);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("new")} description={t("newHint")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            create.mutate(
              {
                name: name.trim(),
                description: description.trim() || undefined,
                amount_minor: amount!,
                currency,
                interval: interval || undefined,
              },
              {
                onSuccess: () => {
                  toast.success(t("created"));
                  onClose();
                },
              },
            );
          }}
        >
          <Field label={t("name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </Field>
          <Field label={t("description")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label={t("price")}>
              <MoneyInput
                value={amountText}
                currency={/^[A-Z]{3}$/.test(currency) ? currency : "USD"}
                onValueChange={(text, minor) => {
                  setAmountText(text);
                  setAmount(minor);
                }}
              />
            </Field>
            <Field label={t("currency")}>
              <Input
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
            </Field>
          </div>
          <Field label={t("billing")}>
            <NativeSelect value={interval} onChange={(e) => setInterval(e.target.value as typeof interval)}>
              <option value="month">{t("monthly")}</option>
              <option value="year">{t("yearly")}</option>
              <option value="">{t("oneTime")}</option>
            </NativeSelect>
          </Field>
          {create.isError && (
            <p className="text-danger text-sm" role="alert">
              {isApiError(create.error) && te.has(create.error.code) ? te(create.error.code) : t("failed")}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!valid} loading={create.isPending}>
              {t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinksCard({ ready }: { ready: boolean }) {
  const t = useTranslations("reseller.links");
  const f = useFormat();
  const links = useResellerLinks();
  const plans = useResellerPlans();
  const { byId } = useClients();
  const setStatus = useSetLinkStatus();
  const [creating, setCreating] = useState(false);
  const activePlans = (plans.data?.data ?? []).filter((p) => p.active);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <Button size="sm" disabled={!ready || activePlans.length === 0} onClick={() => setCreating(true)}>
          <Link2 aria-hidden />
          {t("new")}
        </Button>
      </CardHeader>
      <CardContent>
        {!links.data ? (
          <Skeleton className="h-16 w-full" />
        ) : links.data.data.length === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border grid divide-y">
            {links.data.data.map((l) => (
              <li key={l.id} className="grid gap-2 py-3 sm:flex sm:items-center" data-link={l.plan_name}>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">
                    {l.plan_name}
                    {l.client_id && byId.get(l.client_id) && (
                      <span className="text-muted font-normal"> · {byId.get(l.client_id)!.name}</span>
                    )}
                  </span>
                  <span className="text-muted text-xs">
                    {f.money({ amount_minor: l.amount_minor, currency: l.currency })}{" "}
                    <IntervalLabel interval={l.interval} /> · {t("stats", { opened: l.opened, sales: l.sales })}
                  </span>
                  <code className="text-muted truncate text-xs" dir="ltr">
                    {l.url}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  {l.status === "disabled" && <Badge>{t("off")}</Badge>}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void navigator.clipboard.writeText(l.url).then(() => toast.success(t("copied")))}
                  >
                    <Copy aria-hidden />
                    {t("copy")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setStatus.mutate({ id: l.id, status: l.status === "active" ? "disabled" : "active" })
                    }
                  >
                    {l.status === "active" ? t("turnOff") : t("turnOn")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {creating && <LinkDialog plans={activePlans} onClose={() => setCreating(false)} />}
    </Card>
  );
}

function LinkDialog({ plans, onClose }: { plans: ResellerPlan[]; onClose: () => void }) {
  const t = useTranslations("reseller.links");
  const { clients } = useClients();
  const create = useCreateLink();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={url ? t("ready") : t("new")} description={url ? t("readyHint") : t("newHint")}>
        {url ? (
          <div className="grid gap-4">
            <code className="bg-surface-2 rounded-lg p-3 text-sm break-all" dir="ltr">
              {url}
            </code>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose}>
                {t("done")}
              </Button>
              <Button onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success(t("copied")))}>
                <Copy aria-hidden />
                {t("copy")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(
                { plan_id: planId, client_id: clientId || null, email: email.trim() || undefined },
                { onSuccess: (l) => setUrl(l.url) },
              );
            }}
          >
            <Field label={t("plan")}>
              <NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("client")} hint={t("clientHint")}>
              <NativeSelect value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">{t("anyone")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("email")} hint={t("emailHint")}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={!planId} loading={create.isPending}>
                {t("create")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CustomersCard() {
  const t = useTranslations("reseller.customers");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const overview = useResellerOverview();
  const customers = overview.data?.customers ?? [];
  const sales = overview.data?.sales ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-muted text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-border grid divide-y">
              {customers.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{c.client_name ?? (c.name || c.email)}</span>
                    <span className="text-muted truncate text-xs">
                      {c.plan_name}
                      {c.email && ` · ${c.email}`}
                    </span>
                  </div>
                  <Badge
                    tone={
                      c.status === "active" || c.status === "paid"
                        ? "success"
                        : c.status === "past_due"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {t.has(`status.${c.status}`) ? t(`status.${c.status}`) : c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted text-sm">{t("noActivity")}</p>
          ) : (
            <ul className="divide-border grid divide-y">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm" data-kind={s.kind}>
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate">{t(`kind.${s.kind}`)}</span>
                    <span className="text-muted truncate text-xs">
                      {(s.name || s.email) ?? ""} {f.dateTime(s.occurred_at, tz, "short")}
                    </span>
                  </div>
                  <span className={s.kind === "payment" ? "text-success tabular-nums" : "text-danger tabular-nums"}>
                    {s.kind === "payment" ? "+" : "−"}
                    {f.money({ amount_minor: s.amount_minor, currency: s.currency })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutsCard() {
  const t = useTranslations("reseller.payouts");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const payouts = useResellerPayouts();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!payouts.data ? (
          <Skeleton className="h-12 w-full" />
        ) : payouts.data.data.length === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border grid divide-y">
            {payouts.data.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{f.dateTime(p.arrival_date, tz, "date")}</span>
                <span className="tabular-nums">{f.money({ amount_minor: p.amount_minor, currency: p.currency })}</span>
                <Badge tone={p.status === "paid" ? "success" : "neutral"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
