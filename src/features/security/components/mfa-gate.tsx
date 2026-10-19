"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, ShieldCheck, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { meKey, type Me } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { PasskeyCancelled, usePasskeysSupported } from "@/shared/lib/webauthn";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, Skeleton } from "@/shared/ui/primitives";

import { methodsOf, useAddPasskey, useSecurity } from "../api";

import { RecoveryCodes } from "./recovery-codes";
import { TOTPSetup } from "./totp-setup";
import { VerifyForm } from "./verify-form";

/** UI only: the server withholds agency data until this login proves MFA. */
export function MFAGate({ me }: { me: Me }) {
  const t = useTranslations("security.gate");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const router = useRouter();
  const locale = useLocale();
  const req = me.mfa_required!;
  const security = useSecurity();
  const supported = usePasskeysSupported();
  const addPasskey = useAddPasskey();
  const [setup, setSetup] = useState<"choose" | "totp" | { codes: string[] }>("choose");
  const done = () => {
    track("security.gate.passed", { enrolled: req.enrolled });
    void qc.invalidateQueries({ queryKey: meKey });
  };
  const others = me.agencies.filter((a) => a.id !== req.agency_id);
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

  let body: React.ReactNode;
  if (security.isPending) body = <Skeleton className="h-32 w-full" />;
  else if (req.enrolled) body = <VerifyForm methods={methodsOf(security.data)} onVerified={done} />;
  else if (setup === "totp") body = <TOTPSetup onDone={done} />;
  else if (typeof setup === "object") body = <RecoveryCodes codes={setup.codes} onDone={done} />;
  else
    body = (
      <div className="grid gap-2">
        <Button size="lg" onClick={() => setSetup("totp")}>
          <Smartphone aria-hidden />
          {t("useApp")}
        </Button>
        {supported && security.data?.passkeys_available && (
          <Button
            size="lg"
            variant="secondary"
            loading={addPasskey.isPending}
            onClick={() =>
              addPasskey.mutate("", {
                onSuccess: (r) => (r.recovery_codes.length > 0 ? setSetup({ codes: r.recovery_codes }) : done()),
                onError: (e) => {
                  if (!(e instanceof PasskeyCancelled))
                    toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("network"));
                },
              })
            }
          >
            <Fingerprint aria-hidden />
            {t("usePasskey")}
          </Button>
        )}
      </div>
    );

  return (
    <main className="bg-bg grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="grid gap-4 p-6">
          <div className="grid justify-items-center gap-2 text-center">
            <span className="bg-primary-soft text-primary flex size-12 items-center justify-center rounded-full">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
            <h1 className="text-xl font-semibold">{t("title", { agency: req.agency_name })}</h1>
            <p className="text-muted text-sm">{req.enrolled ? t("verifyHint") : t("setupHint")}</p>
          </div>
          {body}
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
