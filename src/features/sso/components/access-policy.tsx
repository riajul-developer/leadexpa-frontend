"use client";

import { Network } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { NativeSelect, Textarea } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useAccessPolicy, useSaveAccessPolicy } from "../api";

const MAX_HOURS = [8, 12, 24, 72, 168, 720] as const;
const IDLE_MINUTES = [30, 60, 120, 240, 480] as const;

export function AccessPolicyCard() {
  const t = useTranslations("sso.access");
  const q = useAccessPolicy();
  const save = useSaveAccessPolicy();
  const [list, setList] = useState("");
  const [maxHours, setMaxHours] = useState("");
  const [idle, setIdle] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!q.data) return;
    setList(q.data.ip_allowlist.join("\n"));
    setMaxHours(q.data.session_max_hours?.toString() ?? "");
    setIdle(q.data.session_idle_minutes?.toString() ?? "");
  }, [q.data]);
  if (q.isPending || !q.data) return <Skeleton className="h-72 w-full" />;
  const yourIP = q.data.your_ip;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const ip_allowlist = list
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    save.mutate(
      {
        ip_allowlist,
        session_max_hours: maxHours ? Number(maxHours) : null,
        session_idle_minutes: idle ? Number(idle) : null,
      },
      {
        onSuccess: (p) => {
          track("security.access_policy.saved", { networks: p.ip_allowlist.length });
          toast.success(t("saved"));
        },
        onError: (err) => {
          if (!isApiError(err)) return setError(t("failed"));
          if (err.code === "access_policy_lockout") return setError(t("lockout", { ip: yourIP }));
          if (err.code === "plan_limit") return setError(t("plan"));
          if (Object.keys(err.fieldErrors).some((k) => k.startsWith("ip_allowlist"))) return setError(t("invalid"));
          setError(err.message);
        },
      },
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <p className="text-muted text-sm">{t("hint")}</p>
          {error && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <Field label={t("allowlist")} hint={t("allowlistHint")}>
            <Textarea
              dir="ltr"
              rows={4}
              className="font-mono text-xs"
              placeholder={"203.0.113.0/24\n198.51.100.7"}
              value={list}
              onChange={(e) => setList(e.target.value)}
            />
          </Field>
          <p className="text-muted -mt-2 flex flex-wrap items-center gap-2 text-xs">
            {t("yourIP")}{" "}
            <span dir="ltr" className="font-mono" data-testid="your-ip">
              {yourIP}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setList((l) => (l.trim() ? `${l.trim()}\n${yourIP}` : yourIP))}
            >
              {t("addMine")}
            </Button>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("maxAge")} hint={t("maxAgeHint")}>
              <NativeSelect value={maxHours} onChange={(e) => setMaxHours(e.target.value)}>
                <option value="">{t("noLimit")}</option>
                {MAX_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {t("hours", { count: h })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("idle")} hint={t("idleHint")}>
              <NativeSelect value={idle} onChange={(e) => setIdle(e.target.value)}>
                <option value="">{t("noLimit")}</option>
                {IDLE_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {t("minutes", { count: m })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div>
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
