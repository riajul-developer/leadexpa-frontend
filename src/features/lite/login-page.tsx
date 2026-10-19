"use client";

import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { deviceTimeZone, lite, LiteError, localePath } from "./api";

const field =
  "border-border bg-surface h-14 w-full rounded-lg border px-4 text-lg focus-visible:outline-2 focus-visible:outline-offset-2";
const primary =
  "bg-primary text-primary-fg flex h-14 w-full items-center justify-center rounded-lg text-lg font-semibold disabled:opacity-50";

export function LiteLogin({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("lite.login");
  const router = useRouter();
  const locale = useLocale();
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<{ token: string; methods: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recovery, setRecovery] = useState(false);

  const explain = (e: unknown) => {
    if (e instanceof LiteError) {
      if (e.code === "otp_invalid" || e.code === "mfa_invalid") return t("wrongCode");
      if (e.status === 429) return t("tooMany");
      if (e.status === 422) return t("badPhone");
    }
    return t("network");
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await lite<{ challenge_id: string }>("POST", "/v1/auth/otp/start", {
        phone: phone.trim(),
        timezone: deviceTimeZone(),
      });
      setChallenge(r.challenge_id);
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await lite<{ mfa_required?: boolean; mfa_token?: string; methods?: string[] }>(
        "POST",
        "/v1/auth/otp/verify",
        { challenge_id: challenge, code: code.trim(), remember_device: remember },
      );
      if (r?.mfa_required && r.mfa_token) {
        setMfa({ token: r.mfa_token, methods: r.methods ?? [] });
        setRecovery(!r.methods?.includes("totp"));
        setBusy(false);
        return;
      }
      done();
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  };

  const done = () =>
    router.replace(localePath(locale, returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/lite"));

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await lite("POST", "/v1/auth/mfa/verify", {
        mfa_token: mfa!.token,
        method: recovery ? "recovery_code" : "totp",
        code: mfaCode.trim(),
      });
      done();
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-8">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="bg-primary text-primary-fg flex size-14 items-center justify-center rounded-2xl">
          <Phone className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">{mfa ? t("mfaTitle") : challenge ? t("codeTitle") : t("title")}</h1>
        <p className="text-muted text-sm">
          {mfa ? t(recovery ? "mfaRecoveryHint" : "mfaHint") : challenge ? t("codeHint", { phone }) : t("hint")}
        </p>
      </div>
      {error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg p-3 text-sm">
          {error}
        </p>
      )}
      {mfa ? (
        <form className="grid gap-4" onSubmit={verifyMfa}>
          <label className="grid gap-2 text-sm font-medium">
            {recovery ? t("mfaRecovery") : t("mfaCode")}
            <input
              className={`${field} text-center font-mono tracking-widest`}
              inputMode={recovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoCapitalize="none"
              dir="ltr"
              maxLength={32}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
            />
          </label>
          <button type="submit" className={primary} disabled={busy || !mfaCode.trim()}>
            {t("verify")}
          </button>
          {mfa.methods.includes("totp") && mfa.methods.includes("recovery_code") && (
            <button
              type="button"
              className="text-primary min-h-12 text-sm font-medium"
              onClick={() => {
                setRecovery(!recovery);
                setMfaCode("");
                setError(null);
              }}
            >
              {recovery ? t("mfaUseApp") : t("mfaUseRecovery")}
            </button>
          )}
        </form>
      ) : !challenge ? (
        <form className="grid gap-4" onSubmit={send}>
          <label className="grid gap-2 text-sm font-medium">
            {t("phone")}
            <input
              className={field}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button type="submit" className={primary} disabled={busy || !phone.trim()}>
            {t("send")}
          </button>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={verify}>
          <label className="grid gap-2 text-sm font-medium">
            {t("code")}
            <input
              className={`${field} text-center tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={12}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t("remember")}
          </label>
          <button type="submit" className={primary} disabled={busy || !code.trim()}>
            {t("verify")}
          </button>
          <button
            type="button"
            className="text-primary min-h-12 text-sm font-medium"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError(null);
            }}
          >
            {t("changeNumber")}
          </button>
        </form>
      )}
    </main>
  );
}
