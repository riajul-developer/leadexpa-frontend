"use client";

import { Copy, MessageCircle, MessageSquare, Plus, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import type { Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { MoneyInput } from "@/shared/ui/money-input";
import { Dialog, DialogContent } from "@/shared/ui/overlays";
import { Card, Skeleton } from "@/shared/ui/primitives";

import {
  PURPOSES,
  type Purpose,
  useCancelPaymentLink,
  useCreatePaymentLink,
  useLeadPaymentLinks,
  useMarkRefunded,
} from "./api";
import { PaymentStatusBadge, providerName } from "./parts";

type Lead = Schemas["LeadDetail"];

const EXPIRY = [24, 72, 168] as const;

export function LeadPayments({ lead, currency, timeZone }: { lead: Lead; currency: string; timeZone: string }) {
  const t = useTranslations("payments");
  const f = useFormat();
  const canUpdate = useCan("lead.update");
  const canManage = useCan("lead.assign");
  const links = useLeadPaymentLinks(lead.id);
  const cancel = useCancelPaymentLink(lead.id);
  const refunded = useMarkRefunded(lead.id);
  const [open, setOpen] = useState(false);
  const rows = links.data?.data ?? [];
  return (
    <Card className="grid gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="text-accent size-4" aria-hidden />
          {t("title")}
        </h3>
        {canUpdate && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {t("request")}
          </Button>
        )}
      </div>
      {links.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">{t("none")}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((l) => (
            <li key={l.id} className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
              <span className="font-semibold tabular-nums">
                {f.money({ amount_minor: l.amount_minor, currency: l.currency })}
              </span>
              <span className="text-muted">{t(`purpose.${l.purpose}`)}</span>
              <PaymentStatusBadge status={l.status} />
              <span className="text-muted ms-auto text-xs">
                {providerName(l.provider)} ·{" "}
                {l.paid_at
                  ? f.dateTime(l.paid_at, timeZone, "short")
                  : t("expires", { when: f.dateTime(l.expires_at, timeZone, "short") })}
              </span>
              {(l.status === "created" || l.status === "opened" || l.status === "failed") && canUpdate && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={cancel.isPending && cancel.variables === l.id}
                  onClick={() => window.confirm(t("cancelConfirm")) && cancel.mutate(l.id)}
                >
                  {t("cancel")}
                </Button>
              )}
              {l.status === "paid" && canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={refunded.isPending && refunded.variables === l.id}
                  onClick={() => window.confirm(t("refundConfirm")) && refunded.mutate(l.id)}
                >
                  {t("markRefunded")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && <RequestDialog lead={lead} currency={currency} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function RequestDialog({ lead, currency, onClose }: { lead: Lead; currency: string; onClose: () => void }) {
  const t = useTranslations("payments");
  const te = useTranslations("errors");
  const f = useFormat();
  const { byId } = useClients();
  const create = useCreatePaymentLink(lead.id);
  const [text, setText] = useState("");
  const [minor, setMinor] = useState<number | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("booking_fee");
  const [hours, setHours] = useState<number>(72);
  const [note, setNote] = useState("");
  const [key] = useState(() => crypto.randomUUID()); // a double tap makes one link, not two
  const done = create.data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!minor) return;
    create.mutate(
      { key, amount_minor: minor, purpose, note: note.trim() || undefined, expires_in_hours: hours },
      { onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : te("internal")) },
    );
  };

  if (done) {
    const amount = f.money({ amount_minor: done.link.amount_minor, currency: done.link.currency });
    const message = t("shareMessage", {
      name: lead.full_name.split(" ")[0] || "",
      client: byId.get(lead.client_id)?.name ?? "",
      amount,
      purpose: t(`purpose.${done.link.purpose}`),
      url: done.url,
    });
    const digits = (lead.phone?.e164 ?? "").replace(/\D/g, "");
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent title={t("readyTitle")} description={t("readyHint", { amount })}>
          <div className="grid gap-3">
            <code className="bg-surface-2 border-border rounded-lg border p-2 text-xs break-all" dir="ltr">
              {done.url}
            </code>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button asChild disabled={!digits}>
                <a
                  href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden />
                  {t("shareWhatsApp")}
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href={`sms:${lead.phone?.e164 ?? ""}?body=${encodeURIComponent(message)}`}>
                  <MessageSquare aria-hidden />
                  {t("shareSms")}
                </a>
              </Button>
              <Button
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success(t("copied")))}
              >
                <Copy aria-hidden />
                {t("copy")}
              </Button>
            </div>
            <p className="text-muted text-xs">{t("moneyGoesTo")}</p>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={onClose}>
                {t("done")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("request")} description={t("requestHint")}>
        <form onSubmit={submit} className="grid gap-4">
          <Field label={t("amount")}>
            <MoneyInput
              value={text}
              currency={currency}
              onValueChange={(v, m) => {
                setText(v);
                setMinor(m);
              }}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("purposeLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={purpose === p ? "primary" : "secondary"}
                  aria-pressed={purpose === p}
                  onClick={() => setPurpose(p)}
                >
                  {t(`purpose.${p}`)}
                </Button>
              ))}
            </div>
          </fieldset>
          <Field label={t("expiry")}>
            <NativeSelect value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {EXPIRY.map((h) => (
                <option key={h} value={h}>
                  {t("hours", { n: h })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("note")}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancelForm")}
            </Button>
            <Button type="submit" disabled={!minor} loading={create.isPending}>
              {t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
