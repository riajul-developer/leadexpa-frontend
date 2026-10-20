"use client";

import { ArrowUpFromLine, FlaskConical, LogIn, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useSandbox, useSandboxActions, useSandboxOf, useSwitchWorkspace } from "../api";

import { PromoteDialog } from "./promote-dialog";

export function SandboxCard() {
  const t = useTranslations("sandbox");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { data: me } = useMe();
  const owner = me?.membership?.role === "owner";
  const inSandbox = useSandboxOf() !== null;
  const q = useSandbox(!inSandbox);
  const { create, reset, remove } = useSandboxActions();
  const open = useSwitchWorkspace();
  const [leads, setLeads] = useState(20);
  const [realLeads, setRealLeads] = useState(0);
  const [error, setError] = useState<string>();
  const [promoting, setPromoting] = useState(false);
  if (inSandbox) return null; // the banner covers it; a sandbox is managed from the live workspace
  if (q.isPending || !q.data) return <Skeleton className="h-40 w-full" />;
  const sb = q.data.sandbox;
  const clamp = (n: number) => Math.max(0, Math.min(200, Math.trunc(n) || 0));
  const count = clamp(leads);
  const real = clamp(realLeads);
  const errorFor = (e: unknown) =>
    isApiError(e) && e.code === "plan_limit"
      ? t("errors.plan")
      : isApiError(e) && e.code === "sandbox_exists"
        ? t("errors.exists")
        : t("errors.failed");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4" data-testid="sandbox-card">
        <p className="text-muted text-sm">{t("hint")}</p>
        <ul className="text-muted grid list-disc gap-1 ps-5 text-xs">
          <li>{t("safe.messages")}</li>
          <li>{t("safe.emails")}</li>
          <li>{t("safe.outside")}</li>
          <li>{t("safe.members")}</li>
        </ul>
        {error && (
          <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        )}
        {sb ? (
          <div className="grid gap-3">
            <p className="text-sm">{t("exists", { name: sb.name, when: fmt.dateTime(sb.created_at, tz) })}</p>
            {owner && (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("realLeads")} hint={t("realLeadsHint")} className="w-48">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={200}
                    value={realLeads}
                    onChange={(e) => setRealLeads(Number(e.target.value))}
                    data-testid="sandbox-real-leads"
                  />
                </Field>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button loading={open.isPending} onClick={() => open.mutate(sb.id)}>
                <LogIn className="rtl:-scale-x-100" aria-hidden />
                {t("open")}
              </Button>
              {owner && (
                <>
                  <Button variant="secondary" onClick={() => setPromoting(true)}>
                    <ArrowUpFromLine aria-hidden />
                    {t("promote.open")}
                  </Button>
                  <Button
                    variant="secondary"
                    loading={reset.isPending}
                    onClick={() => {
                      if (!window.confirm(t("resetConfirm"))) return;
                      setError(undefined);
                      reset.mutate(
                        { leads: 20, real_leads: real },
                        {
                          onSuccess: () => {
                            track("sandbox.reset", { real_leads: real });
                            toast.success(t("resetDone"));
                          },
                          onError: (e) => setError(errorFor(e)),
                        },
                      );
                    }}
                  >
                    <RotateCcw aria-hidden />
                    {t("reset")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="ms-auto"
                    loading={remove.isPending}
                    onClick={() => {
                      if (!window.confirm(t("deleteConfirm"))) return;
                      remove.mutate(undefined, {
                        onSuccess: () => {
                          track("sandbox.deleted");
                          toast.success(t("deleted"));
                        },
                      });
                    }}
                  >
                    <Trash2 aria-hidden />
                    {t("delete")}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : owner ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(undefined);
              create.mutate(
                { leads: count, real_leads: real },
                {
                  onSuccess: () => {
                    track("sandbox.created", { leads: count, real_leads: real });
                    toast.success(t("created"));
                  },
                  onError: (e) => setError(errorFor(e)),
                },
              );
            }}
          >
            <Field label={t("leads")} hint={t("leadsHint")} className="w-40">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                value={leads}
                onChange={(e) => setLeads(Number(e.target.value))}
              />
            </Field>
            <Field label={t("realLeads")} hint={t("realLeadsHint")} className="w-48">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                value={realLeads}
                onChange={(e) => setRealLeads(Number(e.target.value))}
                data-testid="sandbox-real-leads"
              />
            </Field>
            <Button type="submit" loading={create.isPending}>
              <FlaskConical aria-hidden />
              {t("create")}
            </Button>
          </form>
        ) : (
          <p className="text-muted text-sm">{t("ownersOnly")}</p>
        )}
      </CardContent>
      {promoting && <PromoteDialog onClose={() => setPromoting(false)} />}
    </Card>
  );
}
