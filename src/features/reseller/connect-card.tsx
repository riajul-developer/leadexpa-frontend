"use client";

import { CheckCircle2, CircleAlert, ExternalLink, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { type ConnectedAccount, useOnboarding, useStripeDashboard } from "./api";

const TONE = { none: "neutral", onboarding: "warning", restricted: "warning", active: "success" } as const;

export function ConnectCard({ account, purpose }: { account?: ConnectedAccount; purpose: "reseller" | "partner" }) {
  const t = useTranslations("reseller.account");
  const onboard = useOnboarding();
  const dashboard = useStripeDashboard();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
        {account && <Badge tone={TONE[account.status]}>{t(`status.${account.status}`)}</Badge>}
      </CardHeader>
      <CardContent className="grid gap-3">
        {!account ? (
          <Skeleton className="h-16 w-full" />
        ) : !account.available ? (
          <p className="text-muted text-sm">{t("unavailable")}</p>
        ) : (
          <>
            <p className="text-muted text-sm">{t(`hint.${purpose}`)}</p>
            {account.status === "active" ? (
              <p className="text-success flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4" aria-hidden />
                {t("ready")}
              </p>
            ) : account.status !== "none" ? (
              <p className="text-warning flex items-center gap-2 text-sm">
                <CircleAlert className="size-4" aria-hidden />
                {account.requirements_due > 0 ? t("needs", { count: account.requirements_due }) : t("reviewing")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {account.status !== "active" && (
                <Button loading={onboard.isPending} onClick={() => onboard.mutate()}>
                  {account.status === "none" ? t("connect") : t("continue")}
                </Button>
              )}
              {account.details_submitted && (
                <Button variant="secondary" loading={dashboard.isPending} onClick={() => dashboard.mutate()}>
                  <ExternalLink aria-hidden />
                  {t("dashboard")}
                </Button>
              )}
            </div>
            {account.fee_percent > 0 && purpose === "reseller" && (
              <p className="text-muted text-xs">{t("fee", { percent: account.fee_percent })}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
