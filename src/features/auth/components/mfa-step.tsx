"use client";

import { useMutation } from "@tanstack/react-query";
import { Fingerprint, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { toLatinDigits } from "@/shared/lib/format";
import type { Me } from "@/shared/lib/session";
import { getPasskey, PasskeyCancelled, usePasskeysSupported } from "@/shared/lib/webauthn";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

type Challenge = Schemas["MFAChallenge"];
type Proof = { method: Schemas["MFAMethod"]; code?: string; credential?: Schemas["WebAuthnCredential"] };

export function MFAStep({
  challenge,
  onDone,
  onRestart,
}: {
  challenge: Challenge;
  onDone: (me: Me) => void;
  onRestart: () => void;
}) {
  const t = useTranslations("auth.mfa");
  const te = useTranslations("errors");
  const supported = usePasskeysSupported();
  const hasPasskey = challenge.methods.includes("passkey") && supported;
  const [mode, setMode] = useState<"totp" | "recovery_code">(
    challenge.methods.includes("totp") ? "totp" : "recovery_code",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const explain = (e: unknown) => {
    if (e instanceof PasskeyCancelled) return t("passkeyCancelled");
    if (!isApiError(e)) return te("network");
    if (e.retryAfter) return te("rate_limited_wait", { seconds: e.retryAfter });
    return te.has(e.code) ? te(e.code) : te("internal");
  };
  const verify = useMutation({
    mutationFn: (body: Proof) =>
      unwrap(api.POST("/v1/auth/mfa/verify", { body: { mfa_token: challenge.mfa_token, ...body } })),
    meta: { silent: true },
    onSuccess: (me) => {
      track("auth.mfa.succeeded", { method: mode });
      onDone(me);
    },
    onError: (e) => setError(explain(e)),
  });
  const passkey = useMutation({
    mutationFn: async () => {
      const { options } = await unwrap(
        api.POST("/v1/auth/mfa/passkey-options", { body: { mfa_token: challenge.mfa_token } }),
      );
      return getPasskey(options);
    },
    meta: { silent: true },
    onSuccess: (credential) => verify.mutate({ method: "passkey", credential }),
    onError: (e) => setError(explain(e)),
  });

  const recovery = mode === "recovery_code";
  return (
    <div className="grid gap-4">
      <p className="text-muted text-sm">{t("hint")}</p>
      {error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {hasPasskey && (
        <Button
          type="button"
          size="lg"
          variant={challenge.methods.includes("totp") ? "secondary" : "primary"}
          loading={passkey.isPending}
          onClick={() => {
            setError(null);
            passkey.mutate();
          }}
        >
          <Fingerprint aria-hidden />
          {t("usePasskey")}
        </Button>
      )}
      {(challenge.methods.includes("totp") || challenge.methods.includes("recovery_code")) && (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            verify.mutate({ method: mode, code: toLatinDigits(code).trim() });
          }}
        >
          <Field label={recovery ? t("recoveryLabel") : t("codeLabel")} hint={recovery ? t("recoveryHint") : undefined}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={recovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={recovery ? 32 : 8}
              dir="ltr"
              className="text-center font-mono tracking-widest"
              required
              autoFocus={!hasPasskey}
            />
          </Field>
          <Button type="submit" size="lg" loading={verify.isPending && !passkey.isPending} disabled={!code.trim()}>
            {t("verify")}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {challenge.methods.includes("totp") && challenge.methods.includes("recovery_code") ? (
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setMode(recovery ? "totp" : "recovery_code");
              setCode("");
              setError(null);
            }}
          >
            <KeyRound aria-hidden />
            {recovery ? t("useApp") : t("useRecovery")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="link" onClick={onRestart}>
          {t("restart")}
        </Button>
      </div>
    </div>
  );
}

export function PasskeySignIn({ onDone, onError }: { onDone: (me: Me) => void; onError: (msg: string) => void }) {
  const t = useTranslations("auth.mfa");
  const te = useTranslations("errors");
  const supported = usePasskeysSupported();
  const signIn = useMutation({
    mutationFn: async () => {
      const ceremony = await unwrap(api.POST("/v1/auth/passkey/options"));
      const credential = await getPasskey(ceremony.options);
      return unwrap(api.POST("/v1/auth/passkey/verify", { body: { challenge_id: ceremony.challenge_id, credential } }));
    },
    meta: { silent: true },
    onSuccess: (me) => {
      track("auth.passkey.succeeded");
      onDone(me);
    },
    onError: (e) => {
      if (e instanceof PasskeyCancelled) return;
      onError(isApiError(e) && te.has(e.code) ? te(e.code) : te("network"));
    },
  });
  if (!supported) return null;
  return (
    <Button type="button" size="lg" variant="secondary" loading={signIn.isPending} onClick={() => signIn.mutate()}>
      <Fingerprint aria-hidden />
      {t("signInWithPasskey")}
    </Button>
  );
}
