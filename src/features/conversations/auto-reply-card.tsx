"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { NativeSelect, Textarea } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useChannels, useTemplates, type MessageTemplate } from "./api";

type Responder = Schemas["AutoResponder"];

const DELAYS = [0, 15, 30, 60, 120, 300];
const REASONS = new Set([
  "contact_not_allowed",
  "contact_deferred",
  "already_contacted",
  "junk",
  "no_phone",
  "frequency_capped",
  "messaging_paused",
  "disabled",
  "no_channel_account",
]);

const responderKey = (clientId: string) => ["auto-responder", clientId] as const;

function render(body: string, vars: string[], sample: Record<string, string>) {
  return body.replace(/\{\{(\d+)\}\}/g, (m, n: string) => sample[vars[Number(n) - 1] ?? ""] ?? m);
}

export function AutoReplyCard({ clientId }: { clientId: string }) {
  const t = useTranslations("autoReply");
  const te = useTranslations("errors");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const canManage = useCan("client.manage");
  const { byId } = useClients();
  const q = useQuery({
    queryKey: responderKey(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/auto-responder", { params: { path: { clientId } } })),
  });
  const channels = useChannels(clientId);
  const wa = channels.data?.data.find((a) => a.channel === "whatsapp" && a.status === "active");
  const templates = useTemplates(wa?.id);
  const approved = (templates.data?.data ?? []).filter((x) => x.status === "approved");
  const [draft, setDraft] = useState<Responder | null>(null);
  useEffect(() => {
    if (q.data && !draft) {
      const { enabled, channel, template_name, template_language, sms_text, delay_seconds } = q.data;
      setDraft({ enabled, channel, template_name, template_language, sms_text, delay_seconds });
    }
  }, [q.data, draft]);
  const save = useMutation({
    mutationFn: (body: Responder) =>
      unwrap(api.PUT("/v1/clients/{clientId}/auto-responder", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (r) => {
      qc.setQueryData(responderKey(clientId), r);
      track("auto_reply.saved", { enabled: r.enabled, channel: r.channel, delay: r.delay_seconds });
      toast.success(t(r.enabled ? "savedOn" : "savedOff"));
    },
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("validation_failed")),
  });

  if (q.isPending || !draft || !q.data) return <Skeleton className="h-48 w-full" />;
  const est = q.data.estimate;
  const selected = approved.find((x) => x.name === draft.template_name && x.language === draft.template_language);
  const variants: MessageTemplate[] = selected ? approved.filter((x) => x.name === selected.name) : [];
  const sample = {
    "lead.first_name": "Karim",
    "lead.full_name": "Karim Hasan",
    "lead.phone": "01712-345678",
    "client.name": byId.get(clientId)?.name ?? "",
    "campaign.name": "Eid Offer",
  };
  const smsPreview = (draft.sms_text ?? "")
    .replaceAll("{first_name}", sample["lead.first_name"])
    .replaceAll("{name}", sample["lead.full_name"])
    .replaceAll("{client}", sample["client.name"]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4" aria-hidden />
            {t("title")}
          </CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={draft.enabled}
            disabled={!canManage}
            onCheckedChange={(on) => setDraft({ ...draft, enabled: on })}
            aria-label={t("enable")}
          />
          {draft.enabled ? t("on") : t("off")}
        </label>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <form
          className="grid content-start gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <Field label={t("channel")}>
            <NativeSelect
              value={draft.channel}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, channel: e.target.value as Responder["channel"] })}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </NativeSelect>
          </Field>
          {draft.channel === "whatsapp" ? (
            <Field label={t("template")} hint={wa ? t("templateHint") : t("noNumber")}>
              <NativeSelect
                value={selected ? `${selected.name}|${selected.language}` : ""}
                disabled={!canManage || !wa}
                onChange={(e) => {
                  const [name, language] = e.target.value.split("|");
                  setDraft({ ...draft, template_name: name || null, template_language: language || null });
                }}
              >
                <option value="">{t("pickTemplate")}</option>
                {approved.map((x) => (
                  <option key={x.id} value={`${x.name}|${x.language}`}>
                    {x.name} · {x.language}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <Field label={t("smsText")} hint={t("smsHint")}>
              <Textarea
                rows={3}
                maxLength={600}
                value={draft.sms_text ?? ""}
                disabled={!canManage}
                onChange={(e) => setDraft({ ...draft, sms_text: e.target.value })}
              />
            </Field>
          )}
          <Field label={t("delay")} hint={t("delayHint")}>
            <NativeSelect
              value={draft.delay_seconds}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, delay_seconds: Number(e.target.value) })}
            >
              {DELAYS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? t("immediately") : t("afterSeconds", { s: d })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <p className="text-muted text-xs">{t("quietHours")}</p>
          <p className="bg-surface-2 rounded-lg p-3 text-sm">
            {t("estimate", {
              leads: est.leads_last_30_days,
              price: f.number(est.price_per_message, {
                style: "currency",
                currency: est.currency,
                maximumFractionDigits: 4,
              }),
              total: f.number(est.monthly_cost, {
                style: "currency",
                currency: est.currency,
                maximumFractionDigits: 2,
              }),
            })}
            <span className="text-muted block text-xs">{t("estimateNote")}</span>
          </p>
          {canManage && (
            <Button type="submit" className="justify-self-start" loading={save.isPending}>
              {t("save")}
            </Button>
          )}
        </form>
        <div className="grid content-start gap-3" aria-label={t("preview")}>
          {(draft.channel === "whatsapp" ? variants : [null]).map((v) => (
            <PhonePreview
              key={v?.id ?? "sms"}
              label={v ? v.language : "SMS"}
              text={v ? render(v.body, v.variables, sample) : smsPreview}
              empty={t("previewEmpty")}
            />
          ))}
          {draft.channel === "whatsapp" && variants.length === 0 && (
            <PhonePreview label="WhatsApp" text="" empty={t("previewEmpty")} />
          )}
        </div>
        {q.data.recent_runs.length > 0 && (
          <section className="grid gap-2 lg:col-span-2" aria-labelledby="auto-runs">
            <h3 id="auto-runs" className="text-sm font-semibold">
              {t("recent")}
            </h3>
            <ul className="grid gap-1 text-sm">
              {q.data.recent_runs.map((r) => (
                <li key={r.lead_id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{r.lead_name || "—"}</span>
                  <Badge tone={r.status === "sent" ? "success" : r.status === "deferred" ? "warning" : "neutral"}>
                    {t(`status.${r.status}`)}
                  </Badge>
                  {r.reason && REASONS.has(r.reason) && (
                    <span className="text-muted text-xs">
                      {r.reason === "contact_deferred" && r.defer_until
                        ? t("reason.deferredUntil", { when: f.relative(r.defer_until, now || Date.now()) })
                        : t(`reason.${r.reason}`)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function PhonePreview({ label, text, empty }: { label: string; text: string; empty: string }) {
  return (
    <figure className="border-border bg-surface-2 rounded-3xl border-4 p-3">
      <figcaption className="text-muted mb-2 text-center text-xs uppercase">{label}</figcaption>
      <p
        className="bg-primary-soft ms-auto max-w-[90%] rounded-2xl rounded-ee-sm px-3 py-2 text-sm whitespace-pre-wrap"
        dir="auto"
      >
        {text || <span className="text-muted">{empty}</span>}
      </p>
    </figure>
  );
}
