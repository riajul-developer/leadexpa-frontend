"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SSOSignIn, useSSOErrorMessage } from "@/features/sso";
import { Link, useRouter } from "@/i18n/navigation";
import { browserTimeZone, countryForTimeZone } from "@/shared/config/countries";
import { LOCALES, toApiLocale, type AppLocale } from "@/shared/config/locales";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useApplyApiError } from "@/shared/lib/forms";
import { isHere, lookupRegions, type RegionChoice, regionLoginURL } from "@/shared/lib/regions";
import { meKey, type Me } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { CountrySelect } from "@/shared/ui/locale-fields";
import { EmptyState, Spinner } from "@/shared/ui/primitives";

import { AuthShell } from "./auth-shell";
import { MFAStep, PasskeySignIn } from "./mfa-step";

const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

/** Only same-app relative paths are honored as returnTo (no open redirects). */
function safeReturnTo(v: string | null): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return null;
  return v.replace(LOCALE_PREFIX, "") || "/";
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------

export function LoginForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const schema = z.object({ email: z.string().email(tv("email")), password: z.string().min(1, tv("required")) });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: params.get("email") ?? "" } });
  const apply = useApplyApiError(form.setError);
  // Single sign-on (G7a): a SAML sign-in that failed comes back with ?sso_error=; an organization that turned
  // passwords off answers sso_required, which opens the SSO panel with the email filled in.
  const ssoMessage = useSSOErrorMessage();
  const [error, setError] = useState<string | null>(() =>
    params.get("reason") === "session_policy" ? t("login.sessionPolicy") : ssoMessage(params.get("sso_error")),
  );
  const [ssoRequired, setSSORequired] = useState(false);
  const locale = useLocale();
  // Multi-region (G1): where the account lives. Several regions: the person picks one.
  const [regions, setRegions] = useState<RegionChoice[] | null>(null);
  const [routing, setRouting] = useState(false);
  const submit = async (v: Values) => {
    setRouting(true);
    const found = await lookupRegions(v.email);
    setRouting(false);
    if (found.length > 1) return setRegions(found);
    const only = found[0];
    if (only && !isHere(only)) return window.location.assign(regionLoginURL(only, locale, v.email));
    login.mutate(v);
  };
  // Accounts with two-step sign-in get a challenge instead of a session (17.6).
  const [challenge, setChallenge] = useState<Schemas["MFAChallenge"] | null>(null);
  const signedIn = (me: Me) => {
    qc.setQueryData(meKey, me);
    track("auth.login.succeeded");
    // An agency that requires two-step sign-in, or blocks this network, shows its own gate in the app shell.
    const home =
      me.membership?.role === "client_viewer"
        ? "/portal"
        : me.agency || me.mfa_required || me.access_blocked
          ? "/inbox"
          : "/onboarding/agency";
    router.replace(safeReturnTo(params.get("returnTo")) ?? home);
  };
  const login = useMutation({
    mutationFn: (v: Values) => unwrap(api.POST("/v1/auth/login", { body: v })),
    meta: { silent: true },
    onSuccess: (res) => ("mfa_required" in res && res.mfa_required === true ? setChallenge(res) : signedIn(res)),
    onError: (e) => {
      if (isApiError(e) && e.code === "sso_required") {
        setSSORequired(true);
        return setError(ssoMessage(e.code));
      }
      setError(apply(e, ["email", "password"]));
    },
  });
  if (challenge) {
    return (
      <AuthShell title={t("mfa.title")} subtitle={t("mfa.subtitle")}>
        <MFAStep
          challenge={challenge}
          onDone={signedIn}
          onRestart={() => {
            setChallenge(null);
            form.resetField("password");
          }}
        />
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <>
          {t("login.noAccount")}{" "}
          <Link href="/signup" className="text-primary font-medium">
            {t("signup.cta")}
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormError message={error} />
        {regions && (
          <div role="group" aria-label={t("region.pick")} className="grid gap-2" data-testid="region-picker">
            <p className="text-sm font-medium">{t("region.pick")}</p>
            {regions.map((r) => (
              <Button
                key={r.region}
                type="button"
                variant="secondary"
                onClick={() =>
                  isHere(r)
                    ? (setRegions(null), login.mutate(form.getValues()))
                    : window.location.assign(regionLoginURL(r, locale, form.getValues("email")))
                }
              >
                {t.has(`region.names.${r.region}`) ? t(`region.names.${r.region}`) : r.region}
              </Button>
            ))}
          </div>
        )}
        <Field label={t("email")} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </Field>
        <Field label={t("password")} error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        <div className="-mt-2 text-end">
          <Link href="/forgot-password" className="text-primary text-sm">
            {t("login.forgot")}
          </Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending || routing}>
          {t("login.cta")}
        </Button>
        <PasskeySignIn onDone={signedIn} onError={setError} />
        <SSOSignIn
          email={ssoRequired ? form.getValues("email") : undefined}
          open={ssoRequired}
          returnTo={safeReturnTo(params.get("returnTo"))}
          onError={setError}
        />
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------------------------

export function SignupForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const qc = useQueryClient();
  const schema = z.object({
    name: z.string().trim().min(1, tv("required")).max(200),
    agency_name: z.string().trim().min(1, tv("required")).max(200),
    country: z.string().length(2, tv("required")),
    email: z.string().email(tv("email")),
    password: z
      .string()
      .min(10, tv("passwordMin", { min: 10 }))
      .max(128),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { country: "" } });
  // The browser's zone preselects the country (after mount: the server doesn't know the zone). The
  // server derives currency, weekend and SLA hours from the country.
  useEffect(() => {
    if (!form.getValues("country")) form.setValue("country", countryForTimeZone(browserTimeZone()));
  }, [form]);
  const apply = useApplyApiError(form.setError);
  const [error, setError] = useState<string | null>(null);
  // Partner referral (6c): ?ref=CODE counts the visit; the new agency claims it right after signing up.
  const ref = useSearchParams().get("ref")?.trim().toLowerCase() || null;
  useEffect(() => {
    if (ref)
      void api.POST("/v1/public/referrals/{code}/click", { params: { path: { code: ref } } }).catch(() => undefined);
  }, [ref]);
  const signup = useMutation({
    mutationFn: (v: Values) =>
      unwrap(api.POST("/v1/auth/signup", { body: { ...v, locale: toApiLocale(locale), timezone: browserTimeZone() } })),
    meta: { silent: true },
    onSuccess: async (me) => {
      qc.setQueryData(meKey, me);
      track("auth.signup.succeeded", { country: me.agency?.country, referred: !!ref });
      if (ref) await api.POST("/v1/referrals/claim", { body: { code: ref } }).catch(() => undefined);
      router.replace("/onboarding/agency");
    },
    onError: (e) => setError(apply(e, ["name", "agency_name", "country", "email", "password"])),
  });
  const country = form.watch("country");
  const err = form.formState.errors;
  return (
    <AuthShell
      title={t("signup.title")}
      subtitle={ref ? t("signup.referred") : t("signup.subtitle")}
      footer={
        <>
          {t("signup.haveAccount")}{" "}
          <Link href="/login" className="text-primary font-medium">
            {t("login.cta")}
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={form.handleSubmit((v) => signup.mutate(v))} noValidate>
        <FormError message={error} />
        <Field label={t("name")} error={err.name?.message}>
          <Input autoComplete="name" {...form.register("name")} />
        </Field>
        <Field label={t("agencyName")} error={err.agency_name?.message}>
          <Input autoComplete="organization" {...form.register("agency_name")} />
        </Field>
        <Field label={t("country")} hint={t("countryHint")} error={err.country?.message}>
          <CountrySelect
            value={country}
            onValueChange={(v) => form.setValue("country", v, { shouldValidate: true })}
            placeholder={t("countryPick")}
            autoComplete="country"
          />
        </Field>
        <Field label={t("email")} error={err.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </Field>
        <Field label={t("password")} hint={tv("passwordMin", { min: 10 })} error={err.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Button type="submit" size="lg" loading={signup.isPending}>
          {t("signup.cta")}
        </Button>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------------------------

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const schema = z.object({ email: z.string().email(tv("email")) });
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema) });
  const apply = useApplyApiError(form.setError);
  const [error, setError] = useState<string | null>(null);
  const forgot = useMutation({
    mutationFn: (v: { email: string }) => unwrapEmpty(api.POST("/v1/auth/password/forgot", { body: v })),
    meta: { silent: true },
    onError: (e) => setError(apply(e, ["email"])),
  });
  return (
    <AuthShell
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link href="/login" className="text-primary">
          {t("backToLogin")}
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <EmptyState icon={MailCheck} title={t("forgot.sentTitle")} description={t("forgot.sent")} />
      ) : (
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => forgot.mutate(v))} noValidate>
          <FormError message={error} />
          <Field label={t("email")} error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" {...form.register("email")} />
          </Field>
          <Button type="submit" size="lg" loading={forgot.isPending}>
            {t("forgot.cta")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const token = useSearchParams().get("token") ?? "";
  const schema = z.object({
    password: z
      .string()
      .min(10, tv("passwordMin", { min: 10 }))
      .max(128),
  });
  const form = useForm<{ password: string }>({ resolver: zodResolver(schema) });
  const apply = useApplyApiError(form.setError);
  const [error, setError] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: (v: { password: string }) =>
      unwrapEmpty(api.POST("/v1/auth/password/reset", { body: { token, ...v } })),
    meta: { silent: true },
    onError: (e) => setError(apply(e, ["password"])),
  });
  return (
    <AuthShell title={t("reset.title")}>
      {reset.isSuccess ? (
        <EmptyState
          icon={CheckCircle2}
          title={t("reset.done")}
          action={
            <Button asChild>
              <Link href="/login">{t("login.cta")}</Link>
            </Button>
          }
        />
      ) : (
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => reset.mutate(v))} noValidate>
          <FormError message={token ? error : t("reset.missingToken")} />
          <Field label={t("newPassword")} error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Button type="submit" size="lg" loading={reset.isPending} disabled={!token}>
            {t("reset.cta")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function VerifyEmail() {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const token = useSearchParams().get("token") ?? "";
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: () => unwrapEmpty(api.POST("/v1/auth/verify-email", { body: { token } })),
    meta: { silent: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: meKey }),
  });
  const { mutate } = verify;
  useEffect(() => {
    if (token) mutate();
  }, [token, mutate]);
  return (
    <AuthShell title={t("verify.title")}>
      {verify.isPending || verify.isIdle ? (
        <Spinner label={t("verify.checking")} />
      ) : verify.isSuccess ? (
        <EmptyState
          icon={CheckCircle2}
          title={t("verify.done")}
          action={
            <Button asChild>
              <Link href="/inbox">{t("verify.continue")}</Link>
            </Button>
          }
        />
      ) : (
        <FormError message={te("token_invalid")} />
      )}
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------------------------

export function AcceptInvite({ token }: { token: string }) {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const tr = useTranslations("roles");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const qc = useQueryClient();
  const lookup = useQuery({
    queryKey: ["invite", token],
    queryFn: () => unwrap(api.GET("/v1/invites/lookup", { params: { query: { token } } })),
    retry: false,
    meta: { silent: true },
  });
  const newUser = lookup.data ? !lookup.data.user_exists : false;
  // A phone invite (client staff, 17.0.3) is passwordless: they sign in later with an SMS code.
  const byPhone = !!lookup.data?.phone;
  const schema = z.object({
    name: newUser ? z.string().trim().min(1, tv("required")) : z.string().optional(),
    password: newUser && !byPhone ? z.string().min(10, tv("passwordMin", { min: 10 })) : z.string().optional(),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const apply = useApplyApiError(form.setError);
  const [error, setError] = useState<string | null>(null);
  const accept = useMutation({
    mutationFn: (v: Values) =>
      unwrap(api.POST("/v1/invites/accept", { body: { token, locale: toApiLocale(locale), ...(newUser ? v : {}) } })),
    meta: { silent: true },
    onSuccess: (me) => {
      qc.setQueryData(meKey, me);
      track("team.invite.accepted", { by_phone: byPhone });
      const role = me.membership?.role;
      router.replace(role === "client_agent" ? "/lite" : role === "client_viewer" ? "/portal" : "/inbox");
    },
    onError: (e) => {
      const msg = apply(e, ["name", "password"]);
      // An existing user who isn't signed in must log in first, then come back here.
      if (msg && e && (e as { code?: string }).code === "invite_login_required") {
        const login = byPhone ? "/lite/login" : "/login";
        router.replace(`${login}?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      setError(msg);
    },
  });

  if (lookup.isPending)
    return (
      <AuthShell title={t("invite.title")}>
        <Spinner />
      </AuthShell>
    );
  if (lookup.isError || !lookup.data)
    return (
      <AuthShell title={t("invite.title")}>
        <FormError message={te("invite_invalid")} />
      </AuthShell>
    );
  const inv = lookup.data;
  return (
    <AuthShell
      title={t("invite.join", { agency: inv.agency_name })}
      subtitle={t("invite.as", { role: tr(inv.role), email: inv.email ?? inv.phone ?? "" })}
    >
      <form className="grid gap-4" onSubmit={form.handleSubmit((v) => accept.mutate(v))} noValidate>
        <FormError message={error} />
        {newUser && (
          <>
            <Field label={t("name")} error={form.formState.errors.name?.message}>
              <Input autoComplete="name" {...form.register("name")} />
            </Field>
            {!byPhone && (
              <Field
                label={t("password")}
                hint={tv("passwordMin", { min: 10 })}
                error={form.formState.errors.password?.message}
              >
                <Input type="password" autoComplete="new-password" {...form.register("password")} />
              </Field>
            )}
          </>
        )}
        <Button type="submit" size="lg" loading={accept.isPending}>
          {t("invite.cta")}
        </Button>
      </form>
    </AuthShell>
  );
}
