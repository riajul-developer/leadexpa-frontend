"use client";

import { Network } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
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

import { useAgencyGroup, useAgencyGroupActions } from "../api";

export function GroupSettings() {
  const t = useTranslations("groups.agencySide");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { data: me } = useMe();
  const owner = me?.membership?.role === "owner";
  const q = useAgencyGroup();
  const { join, leave } = useAgencyGroupActions();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const link = q.data?.group ?? null;
  const errorFor = (e: unknown) => {
    if (!isApiError(e)) return t("errors.failed");
    switch (e.code) {
      case "group_invite_invalid":
        return t("errors.invalid");
      case "agency_in_group":
        return t("errors.already");
      case "group_region_mismatch":
        return t("errors.region");
      case "plan_limit":
        return t("errors.plan");
      default:
        return t("errors.failed");
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        {q.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : link ? (
          <div className="grid gap-3" data-testid="agency-group">
            <p className="text-sm">
              {t("member", { name: link.group_name, when: fmt.dateTime(link.joined_at, tz, "date") })}
            </p>
            <p className="text-muted text-xs">{t("whatTheySee")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/groups/${link.group_id}`} className="text-primary text-sm hover:underline">
                {t("open")}
              </Link>
              {owner && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  loading={leave.isPending}
                  onClick={() => {
                    if (!window.confirm(t("leaveConfirm", { name: link.group_name }))) return;
                    leave.mutate(undefined, {
                      onSuccess: () => {
                        track("groups.agency.left");
                        toast.success(t("left"));
                      },
                    });
                  }}
                >
                  {t("leave")}
                </Button>
              )}
            </div>
          </div>
        ) : owner ? (
          <form
            className="flex flex-wrap items-end gap-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return;
              setError(undefined);
              join.mutate(code.trim(), {
                onSuccess: (l) => {
                  track("groups.agency.joined");
                  setCode("");
                  toast.success(t("joined", { name: l.group_name }));
                },
                onError: (e) => setError(errorFor(e)),
              });
            }}
          >
            <Field label={t("code")} hint={t("codeHint")} error={error} className="min-w-60 flex-1">
              <Input value={code} dir="ltr" autoComplete="off" onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button type="submit" loading={join.isPending}>
              {t("join")}
            </Button>
          </form>
        ) : (
          <p className="text-muted text-sm">{t("notInGroup")}</p>
        )}
      </CardContent>
    </Card>
  );
}
