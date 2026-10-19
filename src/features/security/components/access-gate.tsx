"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { api, unwrap, unwrapEmpty } from "@/shared/lib/api/client";
import { type Me } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/primitives";

/** UI only: the server enforces the agency's IP allowlist. */
export function AccessBlockedGate({ me }: { me: Me }) {
  const t = useTranslations("security.accessGate");
  const qc = useQueryClient();
  const router = useRouter();
  const locale = useLocale();
  const block = me.access_blocked!;
  const others = me.agencies.filter((a) => a.id !== block.agency_id);
  const switchAgency = useMutation({
    mutationFn: (agency_id: string) => unwrap(api.POST("/v1/session/agency", { body: { agency_id } })),
    onSuccess: () => {
      qc.clear();
      window.location.assign(`/${locale}/inbox`);
    },
  });
  const logout = useMutation({
    mutationFn: () => unwrapEmpty(api.POST("/v1/auth/logout")),
    onSettled: () => {
      qc.clear();
      router.replace("/login");
    },
  });
  return (
    <main className="bg-bg grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="grid gap-4 p-6">
          <div className="grid justify-items-center gap-2 text-center">
            <span className="bg-warning-soft text-warning flex size-12 items-center justify-center rounded-full">
              <Network className="size-6" aria-hidden />
            </span>
            <h1 className="text-xl font-semibold">{t("title", { agency: block.agency_name })}</h1>
            <p className="text-muted text-sm">{t("hint")}</p>
            <p className="text-sm">
              {t("yourAddress")}{" "}
              <span dir="ltr" className="font-mono" data-testid="blocked-ip">
                {block.ip}
              </span>
            </p>
          </div>
          <Button size="lg" onClick={() => void qc.invalidateQueries()}>
            {t("retry")}
          </Button>
          <div className="border-border flex flex-wrap justify-center gap-2 border-t pt-3">
            {others.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant="ghost"
                loading={switchAgency.isPending && switchAgency.variables === a.id}
                onClick={() => switchAgency.mutate(a.id)}
              >
                {t("switchTo", { agency: a.name })}
              </Button>
            ))}
            <Button size="sm" variant="ghost" loading={logout.isPending} onClick={() => logout.mutate()}>
              {t("signOut")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
