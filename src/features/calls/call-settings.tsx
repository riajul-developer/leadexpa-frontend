"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field, Label } from "@/shared/ui/field";
import { Input, Textarea } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useCallSettings, useMyCallPhone, useSaveCallSettings, useSaveMyCallPhone, type CallSettings } from "./api";
import { useCallErrorToast } from "./errors";

export function CallSettingsPage() {
  const canManage = useCan("integration.manage");
  return (
    <div className="grid gap-4">
      <MyPhone />
      {canManage && <Recording />}
    </div>
  );
}

function MyPhone() {
  const t = useTranslations("settings.calls");
  const q = useMyCallPhone();
  const save = useSaveMyCallPhone();
  const fail = useCallErrorToast();
  const [phone, setPhone] = useState("");
  const id = useId();
  useEffect(() => setPhone(q.data?.phone ?? ""), [q.data?.phone]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("myPhone")}</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-16" />
        ) : (
          <form
            className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(phone.trim() || null, { onSuccess: () => toast.success(t("saved")), onError: fail });
            }}
          >
            <Label htmlFor={`${id}-phone`} className="col-span-2">
              {t("phone")}
            </Label>
            <Input
              id={`${id}-phone`}
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-describedby={`${id}-hint`}
            />
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
            <p id={`${id}-hint`} className="text-muted col-span-2 text-sm">
              {t("phoneHint")}
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Recording() {
  const t = useTranslations("settings.calls");
  const q = useCallSettings();
  const save = useSaveCallSettings();
  const fail = useCallErrorToast();
  const [v, setV] = useState<CallSettings | null>(null);
  useEffect(() => {
    if (q.data) setV(q.data);
  }, [q.data]);
  if (!v) return <Skeleton className="h-40" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("recording")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(v, { onSuccess: () => toast.success(t("saved")), onError: fail });
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="record-calls" className="text-sm font-medium">
                {t("recordCalls")}
              </label>
              <p className="text-muted text-sm">{t("recordCallsHint")}</p>
            </div>
            <Switch
              id="record-calls"
              checked={v.record_calls}
              onCheckedChange={(on) => setV({ ...v, record_calls: on })}
            />
          </div>
          <Field label={t("notice")} hint={t("noticeHint")}>
            <Textarea
              rows={2}
              maxLength={500}
              required={v.record_calls}
              value={v.recording_notice}
              onChange={(e) => setV({ ...v, recording_notice: e.target.value })}
            />
          </Field>
          <Field label={t("retention")} hint={t("retentionHint")}>
            <Input
              type="number"
              min={1}
              max={3650}
              className="w-32"
              value={v.retention_days}
              onChange={(e) => setV({ ...v, retention_days: Number(e.target.value) })}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
