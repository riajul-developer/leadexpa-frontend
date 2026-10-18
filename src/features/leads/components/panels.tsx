"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap } from "@/shared/lib/api/client";
import { useSources } from "@/shared/lib/lookups";
import { leadKeys } from "@/shared/lib/query-keys";
import { useCan, useMe } from "@/shared/lib/session";
import { SourceBadge, type SourceKind } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { MoneyInput } from "@/shared/ui/money-input";
import { Badge, Card, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useRecordSale, useSales, useVoidSale, type LeadDetail } from "../api/hooks";

import { ActionLinkShare } from "./action-link-share";
import { ConsentPanel } from "./consent-panel";

function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </>
  );
}

function asText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** Original form answers (every submission, incl. duplicates), attribution, custom fields and consent. */
export function InfoPanel({ lead, timeZone }: { lead: LeadDetail; timeZone: string }) {
  const t = useTranslations("leadInfo");
  const f = useFormat();
  const sources = useSources(lead.client_id);
  const sourceById = new Map((sources.data?.data ?? []).map((s) => [s.id, s]));
  const utm = Object.entries(lead.utm ?? {});
  const custom = Object.entries(lead.custom_fields ?? {});
  const me = useMe();
  const canAssign = useCan("lead.assign");
  const canShare = !!lead.owner_user_id && (canAssign || lead.owner_user_id === me.data?.user.id);
  return (
    <div className="grid gap-5 p-4 text-sm">
      <section className="grid gap-2">
        <h3 className="font-semibold">{t("attribution")}</h3>
        <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1">
          <KV
            k={t("source")}
            v={(() => {
              const s = sourceById.get(lead.source_id);
              return s ? <SourceBadge kind={s.kind as SourceKind} label={s.name} /> : "—";
            })()}
          />
          <KV k={t("campaign")} v={lead.campaign?.name ?? "—"} />
          {utm.map(([k, v]) => (
            <KV key={k} k={k} v={v} />
          ))}
        </dl>
      </section>
      {custom.length > 0 && (
        <section className="grid gap-2">
          <h3 className="font-semibold">{t("custom")}</h3>
          <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1">
            {custom.map(([k, v]) => (
              <KV key={k} k={k} v={asText(v)} />
            ))}
          </dl>
        </section>
      )}
      <section className="grid gap-2">
        <h3 className="font-semibold">{t("submissions", { count: lead.submissions.length })}</h3>
        {lead.submissions.map((s) => (
          <Card key={s.id} className="grid gap-2 p-3">
            <div className="text-muted flex items-center justify-between gap-2 text-xs">
              <span>{f.dateTime(s.received_at, timeZone)}</span>
              {s.is_duplicate && <Badge tone="warning">{t("duplicate")}</Badge>}
            </div>
            <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1">
              {Object.entries(s.payload ?? {}).map(([k, v]) => (
                <KV key={k} k={k} v={asText(v)} />
              ))}
            </dl>
          </Card>
        ))}
      </section>
      <section className="grid gap-2">
        <h3 className="font-semibold">{t("consent")}</h3>
        <ConsentPanel leadId={lead.id} timeZone={timeZone} />
      </section>
      {canShare && (
        <section className="grid gap-2">
          <h3 className="font-semibold">{t("actionLink")}</h3>
          <ActionLinkShare lead={lead} timeZone={timeZone} />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export function SalesPanel({ lead, currency, timeZone }: { lead: LeadDetail; currency: string; timeZone: string }) {
  const t = useTranslations("sales");
  const tv = useTranslations("validation");
  const f = useFormat();
  const canUpdate = useCan("lead.update");
  const sales = useSales(lead.id);
  const record = useRecordSale(lead);
  const voidSale = useVoidSale(lead.id);
  const [text, setText] = useState("");
  const [minor, setMinor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  // One key per form instance: a retry or double tap replays the same sale instead of recording two.
  const [key, setKey] = useState(() => crypto.randomUUID());

  const submit = () => {
    if (!minor) return;
    record.mutate(
      { sale: { amount_minor: minor, currency, note: note.trim() || undefined }, key },
      {
        onSuccess: () => {
          setText("");
          setMinor(null);
          setNote("");
          setKey(crypto.randomUUID());
        },
      },
    );
  };

  return (
    <div className="grid gap-4 p-4">
      {canUpdate && (
        <Card className="grid gap-3 p-3">
          <h3 className="text-sm font-semibold">{t("add")}</h3>
          <div className="grid items-start gap-3 sm:grid-cols-[10rem_1fr]">
            <Field label={t("amount")} error={text && minor === null ? tv("amount") : undefined}>
              <MoneyInput
                value={text}
                currency={currency}
                onValueChange={(v, m) => {
                  setText(v);
                  setMinor(m);
                }}
              />
            </Field>
            <Field label={t("note")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
          </div>
          <Button onClick={submit} disabled={!minor} loading={record.isPending}>
            {t("save")}
          </Button>
        </Card>
      )}
      {sales.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : !sales.data?.data.length ? (
        <EmptyState icon={Receipt} title={t("empty")} />
      ) : (
        <ul className="grid gap-2">
          {sales.data.data.map((s) => (
            <li key={s.id} className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className={s.voided_at ? "text-muted font-semibold line-through" : "font-semibold"}>
                  {f.money(s.amount)}
                </p>
                <p className="text-muted text-xs">
                  {f.dateTime(s.sold_at, timeZone, "date")} · {t(`source.${s.source}`)}
                  {s.note ? ` · ${s.note}` : ""}
                </p>
              </div>
              {s.voided_at ? (
                <Badge>{t("voided")}</Badge>
              ) : (
                canUpdate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(t("voidConfirm"))) voidSale.mutate(s.id);
                    }}
                  >
                    <Ban aria-hidden />
                    {t("void")}
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

/** Current timer, due time in the client's timezone, breach and escalation history. */
export function SlaPanel({ leadId, timeZone }: { leadId: string; timeZone: string }) {
  const t = useTranslations("slaPanel");
  const f = useFormat();
  const q = useQuery({
    queryKey: leadKeys.sla(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/sla", { params: { path: { leadId } } })),
  });
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  const timers = q.data?.data ?? [];
  if (timers.length === 0) return <p className="text-muted text-sm">{t("none")}</p>;
  return (
    <ul className="grid gap-2 text-sm">
      {timers.map((tm) => (
        <li key={tm.id} className="border-border rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{t(`kind.${tm.kind}`)}</span>
            <Badge
              tone={
                tm.status === "met"
                  ? "success"
                  : tm.status === "breached"
                    ? "danger"
                    : tm.status === "warned"
                      ? "warning"
                      : "neutral"
              }
            >
              {t(`status.${tm.status}`)}
            </Badge>
          </div>
          <p className="text-muted">
            {t("due", { when: f.dateTime(tm.due_at, timeZone) })}
            {tm.business_hours && ` · ${t("businessHours")}`}
          </p>
          {tm.response_seconds != null && (
            <p className="text-muted">{t("responded", { d: f.duration(tm.response_seconds) })}</p>
          )}
          {tm.escalation_level > 0 && <p className="text-danger">{t("escalated", { level: tm.escalation_level })}</p>}
        </li>
      ))}
    </ul>
  );
}
