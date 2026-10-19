"use client";

import { KeySquare, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { type EncryptionKeys, useEncryptionKeyActions, useEncryptionKeys } from "../api";

type Provider = EncryptionKeys["provider"];

export function EncryptionKeysCard() {
  const t = useTranslations("sso.keys");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { data: me } = useMe();
  const owner = me?.membership?.role === "owner";
  const q = useEncryptionKeys();
  const { save, rotate, check } = useEncryptionKeyActions();
  const [provider, setProvider] = useState<Provider>("platform");
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!q.data) return;
    setProvider(q.data.provider);
    setRef(q.data.key_ref);
  }, [q.data]);
  if (q.isPending || !q.data) return <Skeleton className="h-64 w-full" />;
  const k = q.data;
  const errorFor = (e: unknown) => {
    if (!isApiError(e)) return t("errors.failed");
    if (e.code === "plan_limit") return t("errors.plan");
    if (e.code === "kms_unreachable" || e.code === "kms_old_key_unreachable") return e.message;
    if (e.fieldErrors.key_ref) return t("errors.ref");
    return t("errors.failed");
  };
  const changed = provider !== k.provider || ref.trim() !== k.key_ref;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeySquare className="text-accent size-5" aria-hidden />
          {t("title")}
          <Badge tone={k.status === "ok" ? "success" : "danger"}>{t(`status.${k.status}`)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            if (provider !== "platform" && !window.confirm(t("byokConfirm"))) return;
            save.mutate(
              { provider, key_ref: provider === "platform" ? "" : ref.trim() },
              {
                onSuccess: () => {
                  track("security.encryption_keys.saved", { provider });
                  toast.success(t("saved"));
                },
                onError: (e) => setError(errorFor(e)),
              },
            );
          }}
        >
          <p className="text-muted text-sm">{t("hint")}</p>
          {k.status === "unreachable" && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {t("unreachable", { error: k.last_error ?? "" })}
            </p>
          )}
          {error && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <Field label={t("provider")}>
            <NativeSelect value={provider} disabled={!owner} onChange={(e) => setProvider(e.target.value as Provider)}>
              {k.providers.map((p) => (
                <option key={p} value={p}>
                  {t(`providers.${p}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {provider !== "platform" && (
            <Field label={t("keyRef")} hint={t(`refHint.${provider}`)}>
              <Input
                dir="ltr"
                value={ref}
                disabled={!owner}
                placeholder={provider === "aws_kms" ? "arn:aws:kms:eu-west-1:123456789012:key/…" : "test-key-…"}
                onChange={(e) => setRef(e.target.value)}
              />
            </Field>
          )}
          <dl className="text-muted grid gap-1 text-xs" data-testid="key-facts">
            <div>{t("version", { version: k.data_key_version, count: k.data_key_count })}</div>
            {k.last_checked_at && <div>{t("checked", { when: fmt.dateTime(k.last_checked_at, tz) })}</div>}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {owner && (
              <Button type="submit" loading={save.isPending} disabled={!changed}>
                {t("save")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              loading={check.isPending}
              onClick={() =>
                check.mutate(undefined, {
                  onSuccess: (v) => (v.status === "ok" ? toast.success(t("checkOk")) : toast.error(t("checkFailed"))),
                })
              }
            >
              <RefreshCw aria-hidden />
              {t("check")}
            </Button>
            {owner && k.data_key_version > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="ms-auto"
                loading={rotate.isPending}
                onClick={() => {
                  if (!window.confirm(t("rotateConfirm"))) return;
                  rotate.mutate(undefined, {
                    onSuccess: (v) => {
                      track("security.encryption_keys.rotated");
                      toast.success(t("rotated", { version: v.data_key_version }));
                    },
                    onError: (e) => toast.error(errorFor(e)),
                  });
                }}
              >
                {t("rotate")}
              </Button>
            )}
          </div>
          {!owner && <p className="text-muted text-xs">{t("ownersOnly")}</p>}
        </form>
        <LeadPII keys={k} owner={owner} />
      </CardContent>
    </Card>
  );
}

function LeadPII({ keys: k, owner }: { keys: EncryptionKeys; owner: boolean }) {
  const t = useTranslations("sso.keys.leadPII");
  const { leadPII } = useEncryptionKeyActions();
  const on = k.lead_pii === "on" || k.lead_pii === "encrypting";
  const id = useId();
  return (
    <div className="border-border mt-4 grid gap-2 border-t pt-4" data-testid="lead-pii">
      <div className="flex items-start justify-between gap-4">
        <span className="grid gap-0.5">
          <label htmlFor={id} className="text-sm font-medium">
            {t("title")}
          </label>
          <span id={`${id}-hint`} className="text-muted text-xs">
            {t("hint")}
          </span>
        </span>
        <Switch
          id={id}
          checked={on}
          disabled={!owner || leadPII.isPending}
          aria-describedby={`${id}-hint`}
          onCheckedChange={(v) => {
            if (!window.confirm(v ? t("onConfirm") : t("offConfirm"))) return;
            leadPII.mutate(v, {
              onSuccess: () => {
                track("security.lead_pii.changed", { enabled: v });
                toast.success(v ? t("turnedOn") : t("turnedOff"));
              },
              onError: (e) => toast.error(isApiError(e) && e.code === "plan_limit" ? t("plan") : t("failed")),
            });
          }}
        />
      </div>
      <Badge tone={k.lead_pii === "on" ? "success" : k.lead_pii === "off" ? "neutral" : "warning"} className="w-fit">
        {t(`state.${k.lead_pii}`)}
      </Badge>
      {on && <p className="text-muted text-xs">{t("searchNote")}</p>}
    </div>
  );
}
