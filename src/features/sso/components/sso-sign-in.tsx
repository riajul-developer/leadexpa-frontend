"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { toApiLocale, type AppLocale } from "@/shared/config/locales";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { meKey } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/primitives";

import { finishOIDC, startSSO } from "../api";

const KNOWN = ["sso_not_configured", "sso_not_provisioned", "sso_domain_mismatch", "sso_failed", "sso_required"];

/** The message for an SSO error code (from the API or the ?sso_error= the SAML endpoint redirects with). */
export function useSSOErrorMessage() {
  const t = useTranslations("auth.sso.errors");
  return (code: string | null | undefined) => (code ? t(KNOWN.includes(code) ? code : "sso_failed") : null);
}

/**
 * "Sign in with SSO" on the login page: the person's work email finds their organization, then the browser
 * goes to its identity provider.
 */
export function SSOSignIn({
  email: initialEmail,
  returnTo,
  open: forcedOpen,
  onError,
}: {
  email?: string;
  returnTo: string | null;
  open?: boolean;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("auth.sso");
  const locale = useLocale() as AppLocale;
  const message = useSSOErrorMessage();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (forcedOpen) {
      setOpen(true);
      if (initialEmail) setEmail(initialEmail);
    }
  }, [forcedOpen, initialEmail]);
  const go = async () => {
    if (!email.includes("@")) return;
    setPending(true);
    onError(null);
    try {
      const url = await startSSO(email.trim(), returnTo, toApiLocale(locale));
      track("auth.sso.started");
      window.location.assign(url);
    } catch (e) {
      setPending(false);
      onError(message(isApiError(e) ? e.code : "sso_failed"));
    }
  };
  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} data-testid="sso-open">
        <KeyRound aria-hidden />
        {t("cta")}
      </Button>
    );
  }
  return (
    <div className="border-border grid gap-3 rounded-lg border p-3" data-testid="sso-panel">
      <p className="text-muted text-sm">{t("hint")}</p>
      <Field label={t("workEmail")}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void go();
            }
          }}
        />
      </Field>
      <Button type="button" onClick={() => void go()} loading={pending}>
        {t("continue")}
      </Button>
    </div>
  );
}

/** /sso/callback: the identity provider (OIDC) returns here with a code; the API opens the session. */
export function SSOCallback() {
  const t = useTranslations("auth.sso");
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const message = useSSOErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; // the code is single-use (React runs effects twice in development)
    ran.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError(message("sso_failed"));
      return;
    }
    finishOIDC(code, state)
      .then((r) => {
        qc.setQueryData(meKey, r.me);
        track("auth.sso.succeeded");
        router.replace(r.return_to || "/inbox");
      })
      .catch((e) => setError(message(isApiError(e) ? e.code : "sso_failed")));
  }, [params, qc, router, message]);
  if (!error) return <Spinner label={t("signingIn")} />;
  return (
    <div className="grid gap-4">
      <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
        {error}
      </p>
      <Link href="/login" className="text-primary text-sm font-medium">
        {t("backToLogin")}
      </Link>
    </div>
  );
}
