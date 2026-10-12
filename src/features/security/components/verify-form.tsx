"use client";

import { Fingerprint } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isApiError } from "@/shared/lib/api/errors";
import { toLatinDigits } from "@/shared/lib/format";
import { PasskeyCancelled, usePasskeysSupported } from "@/shared/lib/webauthn";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

import { useVerifySession, type MFAMethod } from "../api";

/** Proves a second factor for this login with any method the person has (step-up, 17.6). */
export function VerifyForm({ methods, onVerified }: { methods: MFAMethod[]; onVerified?: () => void }) {
  const t = useTranslations("security.verify");
  const te = useTranslations("errors");
  const supported = usePasskeysSupported();
  const passkey = methods.includes("passkey") && supported;
  const [mode, setMode] = useState<"totp" | "recovery_code">(methods.includes("totp") ? "totp" : "recovery_code");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verify = useVerifySession();
  const run = (p: { method: MFAMethod; code?: string }) => {
    setError(null);
    verify.mutate(p, {
      onSuccess: () => onVerified?.(),
      onError: (e) => {
        if (e instanceof PasskeyCancelled) return;
        if (isApiError(e) && e.retryAfter) setError(te("rate_limited_wait", { seconds: e.retryAfter }));
        else setError(isApiError(e) && te.has(e.code) ? te(e.code) : te("network"));
      },
    });
  };
  const codes = methods.includes("totp") || methods.includes("recovery_code");
  const recovery = mode === "recovery_code";
  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {passkey && (
        <Button
          type="button"
          variant={codes ? "secondary" : "primary"}
          loading={verify.isPending && verify.variables?.method === "passkey"}
          onClick={() => run({ method: "passkey" })}
        >
          <Fingerprint aria-hidden />
          {t("passkey")}
        </Button>
      )}
      {codes && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run({ method: mode, code: toLatinDigits(code).trim() });
          }}
        >
          <Field label={recovery ? t("recovery") : t("code")} className="min-w-40 flex-1">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={recovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
              dir="ltr"
              className="font-mono tracking-widest"
              required
            />
          </Field>
          <Button type="submit" loading={verify.isPending && verify.variables?.method !== "passkey"} disabled={!code}>
            {t("cta")}
          </Button>
        </form>
      )}
      {methods.includes("totp") && methods.includes("recovery_code") && (
        <Button
          type="button"
          variant="link"
          className="justify-self-start"
          onClick={() => {
            setMode(recovery ? "totp" : "recovery_code");
            setCode("");
          }}
        >
          {recovery ? t("useApp") : t("useRecovery")}
        </Button>
      )}
    </div>
  );
}
