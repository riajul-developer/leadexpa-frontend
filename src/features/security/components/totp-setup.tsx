"use client";

import { useMutation } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { toLatinDigits } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/primitives";
import { QRCode } from "@/shared/ui/qr-code";

import { useRefreshSecurity } from "../api";

import { RecoveryCodes } from "./recovery-codes";

export function TOTPSetup({ onDone }: { onDone: () => void }) {
  const t = useTranslations("security.totp");
  const te = useTranslations("errors");
  const refresh = useRefreshSecurity();
  const finish = () => {
    void refresh();
    onDone();
  };
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const setup = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/me/security/totp/setup")),
    meta: { silent: true },
  });
  const { mutate: start } = setup;
  useEffect(() => start(), [start]);
  const confirm = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/v1/me/security/totp/confirm", { body: { code: toLatinDigits(code).replace(/\s/g, "") } })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("security.totp.enabled");
      if (r.recovery_codes.length > 0) {
        void refresh({ me: false });
        setCodes(r.recovery_codes);
      } else finish();
    },
  });
  const err = setup.error ?? confirm.error;
  const message = err ? (isApiError(err) && te.has(err.code) ? te(err.code) : te("network")) : null;

  if (codes) return <RecoveryCodes codes={codes} onDone={finish} />;
  const secret = setup.data?.secret ?? "";
  return (
    <div className="grid gap-4">
      {message && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {message}
        </p>
      )}
      <ol className="grid list-decimal gap-1 ps-5 text-sm">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
      <div className="grid justify-items-center gap-3">
        {setup.data ? <QRCode value={setup.data.otpauth_uri} label={t("qr")} /> : <Skeleton className="size-46" />}
        {secret && (
          <div className="grid justify-items-center gap-1 text-center">
            <p className="text-muted text-xs">{t("manual")}</p>
            <div className="flex items-center gap-1">
              <code className="bg-surface-2 rounded px-2 py-1 font-mono text-sm break-all" dir="ltr">
                {secret.match(/.{1,4}/g)?.join(" ")}
              </code>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t("copyKey")}
                onClick={() => void navigator.clipboard.writeText(secret).then(() => toast.success(t("copied")))}
              >
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          confirm.mutate();
        }}
      >
        <Field label={t("code")}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            dir="ltr"
            className="text-center font-mono tracking-widest"
            required
          />
        </Field>
        <Button type="submit" loading={confirm.isPending} disabled={!setup.data || code.trim().length < 6}>
          {t("confirm")}
        </Button>
      </form>
    </div>
  );
}
