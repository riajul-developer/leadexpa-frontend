"use client";

import { ShieldCheck, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/controls";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type PaymentAccount,
  type PaymentStatus,
  useClientPaymentLinks,
  useConnectAccount,
  usePaymentAccounts,
  useRemoveAccount,
  useUpdateAccount,
} from "./api";
import { PaymentStatusBadge, providerName } from "./parts";

const FIELDS = {
  bkash: ["username", "password", "app_key", "app_secret"],
  sslcommerz: ["store_id", "store_password"],
} as const;

/** Client › Payments: the client's own merchant accounts and the payment links sent to its leads (17.0.2). */
export function ClientPayments({ clientId }: { clientId: string }) {
  const canIntegrate = useCan("integration.manage");
  return (
    <div className="grid gap-4">
      <Revenue clientId={clientId} />
      {canIntegrate && <Accounts clientId={clientId} />}
      <Links clientId={clientId} />
    </div>
  );
}

function Revenue({ clientId }: { clientId: string }) {
  const t = useTranslations("payments.client");
  const f = useFormat();
  const { data } = useClientPaymentLinks(clientId);
  const s = data?.summary;
  return (
    <Card className="relative overflow-hidden p-4">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
      <p className="text-muted text-sm">{t("revenue")}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {s ? f.money({ amount_minor: s.paid_minor, currency: s.currency }) : "—"}
      </p>
      <p className="text-muted text-sm">{s ? t("counts", { paid: s.paid, open: s.open }) : ""}</p>
    </Card>
  );
}

function Accounts({ clientId }: { clientId: string }) {
  const t = useTranslations("payments.accounts");
  const { data, isPending } = usePaymentAccounts(clientId);
  const [connecting, setConnecting] = useState(false);
  const accounts = data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="text-accent size-4" aria-hidden />
            {t("title")}
          </CardTitle>
          <p className="text-muted flex items-start gap-1.5 text-sm">
            <ShieldCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
            {t("directly")}
          </p>
        </div>
        {!connecting && (
          <Button size="sm" onClick={() => setConnecting(true)}>
            {t("connect")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          accounts.map((a) => <AccountRow key={a.id} clientId={clientId} account={a} />)
        )}
        {!isPending && accounts.length === 0 && !connecting && <p className="text-muted text-sm">{t("none")}</p>}
        {connecting && <ConnectForm clientId={clientId} onDone={() => setConnecting(false)} />}
      </CardContent>
    </Card>
  );
}

function AccountRow({ clientId, account: a }: { clientId: string; account: PaymentAccount }) {
  const t = useTranslations("payments.accounts");
  const update = useUpdateAccount(clientId);
  const remove = useRemoveAccount(clientId);
  return (
    <div className="border-border grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{providerName(a.provider)}</span>
        <Badge tone={a.mode === "live" ? "success" : "warning"}>{t(`mode.${a.mode}`)}</Badge>
        <Badge tone={a.status === "active" ? "success" : "neutral"}>{t(`status.${a.status}`)}</Badge>
        <span className="ms-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            loading={update.isPending}
            onClick={() => update.mutate({ id: a.id, status: a.status === "active" ? "disabled" : "active" })}
          >
            {a.status === "active" ? t("disable") : t("enable")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            loading={remove.isPending}
            onClick={() => window.confirm(t("removeConfirm")) && remove.mutate(a.id)}
          >
            {t("remove")}
          </Button>
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={a.auto_won} onCheckedChange={(v) => update.mutate({ id: a.id, auto_won: v })} />
        {t("autoWon")}
      </label>
    </div>
  );
}

function ConnectForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const t = useTranslations("payments.accounts");
  const te = useTranslations("errors");
  const connect = useConnectAccount(clientId);
  const [provider, setProvider] = useState<"bkash" | "sslcommerz">("bkash");
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const fields = FIELDS[provider];
  const complete = fields.every((k) => (creds[k] ?? "").trim() !== "");
  return (
    <form
      className="bg-surface-2 grid gap-3 rounded-lg p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        connect.mutate(
          { provider, mode, credentials: Object.fromEntries(fields.map((k) => [k, creds[k]!.trim()])) },
          {
            onSuccess: () => {
              toast.success(t("connected"));
              onDone();
            },
            onError: (err) =>
              setError(
                isApiError(err) && te.has(err.code) ? te(err.code) : isApiError(err) ? err.message : te("internal"),
              ),
          },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("provider")}>
          <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value as "bkash" | "sslcommerz")}>
            <option value="bkash">bKash</option>
            <option value="sslcommerz">SSLCommerz</option>
          </NativeSelect>
        </Field>
        <Field label={t("modeLabel")} hint={t("modeHint")}>
          <NativeSelect value={mode} onChange={(e) => setMode(e.target.value as "sandbox" | "live")}>
            <option value="sandbox">{t("mode.sandbox")}</option>
            <option value="live">{t("mode.live")}</option>
          </NativeSelect>
        </Field>
        {fields.map((k) => (
          <Field key={k} label={t(`fields.${k}`)}>
            <Input
              type={k.includes("password") || k.includes("secret") ? "password" : "text"}
              autoComplete="off"
              dir="ltr"
              value={creds[k] ?? ""}
              onChange={(e) => setCreds((c) => ({ ...c, [k]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <p className="text-muted text-xs">{t("verifyHint")}</p>
      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={!complete} loading={connect.isPending}>
          {t("verifyAndSave")}
        </Button>
      </div>
    </form>
  );
}

const FILTERS: (PaymentStatus | undefined)[] = [undefined, "paid", "opened", "created", "failed", "expired"];

function Links({ clientId }: { clientId: string }) {
  const t = useTranslations("payments.client");
  const ts = useTranslations("payments.status");
  const tp = useTranslations("payments.purpose");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const [status, setStatus] = useState<PaymentStatus | undefined>(undefined);
  const { data, isPending } = useClientPaymentLinks(clientId, status);
  const rows = data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("links")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("filter")}>
          {FILTERS.map((s) => (
            <Button
              key={s ?? "all"}
              size="sm"
              variant={status === s ? "primary" : "secondary"}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s ? ts(s) : t("all")}
            </Button>
          ))}
        </div>
        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title={t("empty")} description={t("emptyHint")} className="py-6" />
        ) : (
          <ul className="divide-border grid divide-y text-sm">
            {rows.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-semibold tabular-nums">
                  {f.money({ amount_minor: l.amount_minor, currency: l.currency })}
                </span>
                <span className="text-muted">{tp(l.purpose)}</span>
                <PaymentStatusBadge status={l.status} />
                <Link href={`/leads/${l.lead_id}`} className="text-primary text-xs underline-offset-2 hover:underline">
                  {t("openLead")}
                </Link>
                <span className="text-muted ms-auto text-xs tabular-nums">
                  {providerName(l.provider)} · {f.dateTime(l.paid_at ?? l.created_at, tz, "short")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
