"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MessageSquare, RefreshCw, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { channelKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useChannels, useTemplates, type ChannelAccount, type MessageTemplate } from "./api";
import { AutoReplyCard } from "./auto-reply-card";

const VARIABLES = ["lead.first_name", "lead.full_name", "lead.phone", "client.name", "campaign.name"] as const;
type Variable = (typeof VARIABLES)[number];

export function ChannelsTab({ clientId }: { clientId: string }) {
  const t = useTranslations("channels");
  const canManage = useCan("integration.manage");
  const q = useChannels(clientId);
  const [adding, setAdding] = useState<"whatsapp" | "sms" | null>(null);
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  const accounts = (q.data?.data ?? []).filter((a) => a.status === "active");
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        {canManage && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setAdding("sms")}>
              <MessageSquare aria-hidden />
              {t("addSms")}
            </Button>
            <Button size="sm" onClick={() => setAdding("whatsapp")}>
              <MessageCircle aria-hidden />
              {t("addWhatsApp")}
            </Button>
          </>
        )}
      </div>
      {adding === "whatsapp" && <ConnectWhatsApp clientId={clientId} onDone={() => setAdding(null)} />}
      {adding === "sms" && <ConnectSms clientId={clientId} onDone={() => setAdding(null)} />}
      {accounts.length > 0 && <AutoReplyCard clientId={clientId} />}
      {accounts.length === 0 && !adding ? (
        <EmptyState icon={MessageCircle} title={t("empty")} description={t("emptyHint")} />
      ) : (
        accounts.map((a) => <AccountCard key={a.id} a={a} clientId={clientId} canManage={canManage} />)
      )}
    </div>
  );
}

function useApiToast() {
  const te = useTranslations("errors");
  return (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
}

function ConnectWhatsApp({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const t = useTranslations("channels");
  const qc = useQueryClient();
  const fail = useApiToast();
  const [v, setV] = useState({ phone_number_id: "", waba_id: "", access_token: "", display_phone: "" });
  const connect = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/v1/clients/{clientId}/channels/whatsapp", { params: { path: { clientId } }, body: v })),
    meta: { silent: true },
    onSuccess: () => {
      track("channel.whatsapp.connected");
      toast.success(t("connected"));
      void qc.invalidateQueries({ queryKey: channelKeys.client(clientId) });
      onDone();
    },
    onError: fail,
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("addWhatsApp")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            connect.mutate();
          }}
        >
          <p className="text-muted text-sm sm:col-span-2">{t("whatsAppHint")}</p>
          <Field label={t("phoneNumberId")}>
            <Input required dir="ltr" value={v.phone_number_id} onChange={set("phone_number_id")} />
          </Field>
          <Field label={t("wabaId")}>
            <Input required dir="ltr" value={v.waba_id} onChange={set("waba_id")} />
          </Field>
          <Field label={t("accessToken")} hint={t("accessTokenHint")}>
            <Input
              required
              type="password"
              dir="ltr"
              autoComplete="off"
              value={v.access_token}
              onChange={set("access_token")}
            />
          </Field>
          <Field label={t("displayPhone")}>
            <Input dir="ltr" value={v.display_phone} onChange={set("display_phone")} placeholder="+880 1711-000000" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onDone}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={connect.isPending}>
              {t("connect")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ConnectSms({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const t = useTranslations("channels");
  const qc = useQueryClient();
  const fail = useApiToast();
  const [sender, setSender] = useState("");
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/channels/sms", {
          params: { path: { clientId } },
          body: { sender_id: sender.trim() },
        }),
      ),
    meta: { silent: true },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: channelKeys.client(clientId) });
      onDone();
    },
    onError: fail,
  });
  return (
    <Card>
      <CardContent className="pt-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Field label={t("senderId")} hint={t("senderIdHint")} className="flex-1">
            <Input required maxLength={20} value={sender} onChange={(e) => setSender(e.target.value)} />
          </Field>
          <Button type="button" variant="secondary" onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={add.isPending}>
            {t("add")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountCard({ a, clientId, canManage }: { a: ChannelAccount; clientId: string; canManage: boolean }) {
  const t = useTranslations("channels");
  const qc = useQueryClient();
  const fail = useApiToast();
  const disconnect = useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/channels/{accountId}", { params: { path: { accountId: a.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: channelKeys.client(clientId) }),
    onError: fail,
  });
  const sync = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/v1/channels/{accountId}/templates/sync", { params: { path: { accountId: a.id } } })),
    meta: { silent: true },
    onSuccess: (r) => qc.setQueryData(channelKeys.templates(a.id), r),
    onError: fail,
  });
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {a.channel === "whatsapp" ? (
            <MessageCircle className="text-success size-4" aria-hidden />
          ) : (
            <MessageSquare className="text-muted size-4" aria-hidden />
          )}
          <CardTitle dir="ltr">{a.display_name || a.external_id}</CardTitle>
          <Badge>{t(`channel.${a.channel}`)}</Badge>
        </div>
        {canManage && (
          <div className="flex gap-1">
            {a.channel === "whatsapp" && (
              <Button size="sm" variant="ghost" onClick={() => sync.mutate()} loading={sync.isPending}>
                <RefreshCw aria-hidden />
                {t("sync")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.confirm(t("disconnectConfirm")) && disconnect.mutate()}
              loading={disconnect.isPending}
            >
              <Unplug aria-hidden />
              {t("disconnect")}
            </Button>
          </div>
        )}
      </CardHeader>
      {a.channel === "whatsapp" && (
        <CardContent>
          <Templates accountId={a.id} canManage={canManage} />
        </CardContent>
      )}
    </Card>
  );
}

function Templates({ accountId, canManage }: { accountId: string; canManage: boolean }) {
  const t = useTranslations("channels");
  const q = useTemplates(accountId);
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  const rows = q.data?.data ?? [];
  if (rows.length === 0) return <p className="text-muted text-sm">{t("noTemplates")}</p>;
  return (
    <ul className="grid gap-3">
      {rows.map((tpl) => (
        <TemplateRow key={tpl.id} tpl={tpl} accountId={accountId} canManage={canManage} />
      ))}
    </ul>
  );
}

function TemplateRow({ tpl, accountId, canManage }: { tpl: MessageTemplate; accountId: string; canManage: boolean }) {
  const t = useTranslations("channels");
  const qc = useQueryClient();
  const fail = useApiToast();
  const save = useMutation({
    mutationFn: (variables: Variable[]) =>
      unwrap(
        api.PUT("/v1/templates/{templateId}/variables", {
          params: { path: { templateId: tpl.id } },
          body: { variables },
        }),
      ),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: channelKeys.templates(accountId) }),
    onError: fail,
  });
  return (
    <li className="border-border grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium" dir="ltr">
          {tpl.name}
        </span>
        <Badge>{tpl.language}</Badge>
        <Badge tone={tpl.status === "approved" ? "success" : tpl.status === "rejected" ? "danger" : "warning"}>
          {t(`status.${tpl.status}`)}
        </Badge>
        <span className="text-muted text-xs">{t(`category.${tpl.category}`)}</span>
      </div>
      <p className="bg-surface-2 rounded p-2 text-sm whitespace-pre-wrap" dir="auto">
        {tpl.body}
      </p>
      {tpl.variables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tpl.variables.map((v, i) => (
            <label key={i} className="flex items-center gap-1 text-xs">
              <span className="text-muted" dir="ltr">{`{{${i + 1}}}`}</span>
              <NativeSelect
                className="h-8 w-auto text-xs"
                value={v}
                disabled={!canManage || save.isPending}
                aria-label={t("variableFor", { n: i + 1 })}
                onChange={(e) => save.mutate(tpl.variables.map((x, j) => (j === i ? e.target.value : x)) as Variable[])}
              >
                {VARIABLES.map((f) => (
                  <option key={f} value={f}>
                    {t(`field.${f.replace(".", "_")}`)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ))}
        </div>
      )}
    </li>
  );
}
