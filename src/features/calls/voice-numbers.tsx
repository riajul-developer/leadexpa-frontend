"use client";

import { Copy, Phone, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useConnectVoiceNumber, useDisconnectVoiceNumber, useVoiceNumbers, type VoiceNumber } from "./api";
import { useCallErrorToast } from "./errors";

export function VoiceNumbers({ clientId }: { clientId: string }) {
  const t = useTranslations("calls.numbers");
  const canManage = useCan("integration.manage");
  const q = useVoiceNumbers(clientId);
  const [adding, setAdding] = useState(false);
  const numbers = (q.data?.data ?? []).filter((n) => n.status === "active");
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Phone className="text-muted size-4" aria-hidden />
        <CardTitle className="flex-1">{t("title")}</CardTitle>
        {canManage && !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            {t("add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted text-sm">{t("hint")}</p>
        {adding && <ConnectForm clientId={clientId} onDone={() => setAdding(false)} />}
        {q.isPending ? (
          <Skeleton className="h-12" />
        ) : numbers.length === 0 ? (
          !adding && <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <ul className="grid gap-2">
            {numbers.map((n) => (
              <NumberRow key={n.id} n={n} clientId={clientId} canManage={canManage} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NumberRow({ n, clientId, canManage }: { n: VoiceNumber; clientId: string; canManage: boolean }) {
  const t = useTranslations("calls.numbers");
  const disconnect = useDisconnectVoiceNumber(clientId);
  const copy = (v: string) => void navigator.clipboard.writeText(v).then(() => toast.success(t("copied")));
  return (
    <li className="border-border grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium tabular-nums" dir="ltr">
          {n.number}
        </span>
        <Badge tone="primary">{t(`provider.${n.provider}`)}</Badge>
        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => disconnect.mutate(n.id)}
            loading={disconnect.isPending}
            aria-label={t("disconnect", { number: n.number })}
          >
            <Unplug aria-hidden />
          </Button>
        )}
      </div>
      {n.webhook_url && (
        <div className="grid gap-1 text-sm">
          <span className="text-muted">{t("webhook")}</span>
          <span className="flex items-center gap-2">
            <code className="bg-surface-2 min-w-0 flex-1 truncate rounded px-2 py-1 text-xs" dir="ltr">
              {n.webhook_url}
            </code>
            <Button size="sm" variant="ghost" onClick={() => copy(n.webhook_url!)} aria-label={t("copyWebhook")}>
              <Copy aria-hidden />
            </Button>
          </span>
        </div>
      )}
    </li>
  );
}

function ConnectForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const t = useTranslations("calls.numbers");
  const connect = useConnectVoiceNumber(clientId);
  const fail = useCallErrorToast();
  const [v, setV] = useState({ provider: "pbx" as "pbx" | "twilio", number: "", account_id: "", auth_token: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const body = v.provider === "twilio" ? v : { provider: v.provider, number: v.number };
        connect.mutate(body, {
          onSuccess: () => {
            toast.success(t("connected"));
            onDone();
          },
          onError: fail,
        });
      }}
    >
      <Field label={t("providerLabel")}>
        <NativeSelect value={v.provider} onChange={set("provider")}>
          <option value="pbx">{t("provider.pbx")}</option>
          <option value="twilio">{t("provider.twilio")}</option>
        </NativeSelect>
      </Field>
      <Field label={t("number")}>
        <Input required dir="ltr" value={v.number} onChange={set("number")} placeholder="+880 9610-000000" />
      </Field>
      {v.provider === "twilio" && (
        <>
          <Field label={t("accountSid")}>
            <Input required dir="ltr" value={v.account_id} onChange={set("account_id")} autoComplete="off" />
          </Field>
          <Field label={t("authToken")} hint={t("authTokenHint")}>
            <Input
              required
              type="password"
              dir="ltr"
              autoComplete="off"
              value={v.auth_token}
              onChange={set("auth_token")}
            />
          </Field>
        </>
      )}
      <p className="text-muted text-sm sm:col-span-2">{t(v.provider === "pbx" ? "pbxHint" : "twilioHint")}</p>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={connect.isPending}>
          {t("connect")}
        </Button>
      </div>
    </form>
  );
}
