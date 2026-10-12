"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, KeyRound, LogOut, Pencil, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useMe } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { useUpdateMe } from "@/shared/lib/update-me";
import { PasskeyCancelled, usePasskeysSupported } from "@/shared/lib/webauthn";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Dialog, DialogContent, Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  methodsOf,
  useAddPasskey,
  useRefreshSecurity,
  useSecurity,
  useSessions,
  type SecurityOverview,
  type Session,
} from "../api";

import { RecoveryCodes } from "./recovery-codes";
import { TOTPSetup } from "./totp-setup";
import { VerifyForm } from "./verify-form";

/** Settings › Security (FRONTEND_PROMPT 17.6): two-step sign-in, passkeys, devices, sign-in alerts, activity. */
export function SecuritySettings() {
  const { data: s } = useSecurity();
  if (!s) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="grid gap-4">
      <TwoStepCard s={s} />
      <SessionsCard />
      <AlertsCard s={s} />
      <ActivityCard s={s} />
    </div>
  );
}

/** Localized text for an API error, for toasts. */
function useErrorText() {
  const te = useTranslations("errors");
  return (e: unknown) => (isApiError(e) && te.has(e.code) ? te(e.code) : te("network"));
}

// ---------------------------------------------------------------------------------------------

function TwoStepCard({ s }: { s: SecurityOverview }) {
  const t = useTranslations("security");
  const errorText = useErrorText();
  const refresh = useRefreshSecurity();
  const supported = usePasskeysSupported();
  const methods = methodsOf(s);
  const enrolled = s.totp_enabled || s.passkeys.length > 0;
  // Once there is a method, changing methods needs a login that proved one.
  const locked = enrolled && !s.session_verified;
  const [dialog, setDialog] = useState<"totp" | { codes: string[] } | null>(null);
  const [passkeyName, setPasskeyName] = useState("");
  const [adding, setAdding] = useState(false);
  const addPasskey = useAddPasskey();
  const removeTOTP = useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/me/security/totp")),
    meta: { silent: true },
    onSuccess: () => {
      track("security.totp.disabled");
      void refresh();
      toast.success(t("totp.removed"));
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const regenerate = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/me/security/recovery-codes")),
    meta: { silent: true },
    onSuccess: (r) => {
      void refresh();
      setDialog({ codes: r.recovery_codes });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("twoStep.title")}</CardTitle>
        <Badge tone={enrolled ? "success" : "warning"}>
          {enrolled ? <ShieldCheck aria-hidden /> : <ShieldAlert aria-hidden />}
          {enrolled ? t("twoStep.on") : t("twoStep.off")}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-muted text-sm">{t("twoStep.explain")}</p>
        {s.required_by.length > 0 && (
          <p className="bg-info-soft text-info rounded-lg px-3 py-2 text-sm">
            {t("twoStep.requiredBy", { agencies: s.required_by.map((a) => a.name).join(", ") })}
          </p>
        )}
        {locked && (
          <div className="border-border grid gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">{t("twoStep.verifyFirst")}</p>
            <VerifyForm methods={methods} />
          </div>
        )}

        {/* Authenticator app */}
        <section className="grid gap-2" aria-labelledby="sec-totp">
          <div className="flex flex-wrap items-center gap-3">
            <Smartphone className="text-muted size-5" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 id="sec-totp" className="text-sm font-medium">
                {t("totp.title")}
              </h3>
              <p className="text-muted text-sm">{s.totp_enabled ? t("totp.onHint") : t("totp.offHint")}</p>
            </div>
            {s.totp_enabled ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={locked}
                loading={removeTOTP.isPending}
                onClick={() => window.confirm(t("totp.removeConfirm")) && removeTOTP.mutate()}
              >
                {t("totp.remove")}
              </Button>
            ) : (
              <Button size="sm" disabled={locked} onClick={() => setDialog("totp")}>
                {t("totp.setup")}
              </Button>
            )}
          </div>
        </section>

        {/* Passkeys */}
        <section className="grid gap-2" aria-labelledby="sec-passkeys">
          <div className="flex flex-wrap items-center gap-3">
            <Fingerprint className="text-muted size-5" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 id="sec-passkeys" className="text-sm font-medium">
                {t("passkeys.title")}
              </h3>
              <p className="text-muted text-sm">
                {!s.passkeys_available
                  ? t("passkeys.unavailable")
                  : supported
                    ? t("passkeys.hint")
                    : t("passkeys.unsupported")}
              </p>
            </div>
            {s.passkeys_available && supported && !adding && (
              <Button size="sm" variant="secondary" disabled={locked} onClick={() => setAdding(true)}>
                {t("passkeys.add")}
              </Button>
            )}
          </div>
          {adding && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addPasskey.mutate(passkeyName, {
                  onSuccess: (r) => {
                    track("security.passkey.added");
                    setAdding(false);
                    setPasskeyName("");
                    if (r.recovery_codes.length > 0) setDialog({ codes: r.recovery_codes });
                    else toast.success(t("passkeys.added"));
                  },
                  onError: (e) => {
                    if (!(e instanceof PasskeyCancelled)) toast.error(errorText(e));
                  },
                });
              }}
            >
              <Field label={t("passkeys.name")} hint={t("passkeys.nameHint")} className="min-w-48 flex-1">
                <Input value={passkeyName} maxLength={60} onChange={(e) => setPasskeyName(e.target.value)} />
              </Field>
              <Button type="submit" loading={addPasskey.isPending}>
                {t("passkeys.create")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                {t("cancel")}
              </Button>
            </form>
          )}
          {s.passkeys.length > 0 && (
            <ul className="grid gap-2">
              {s.passkeys.map((p) => (
                <PasskeyRow key={p.id} passkey={p} locked={locked} />
              ))}
            </ul>
          )}
        </section>

        {/* Recovery codes */}
        {enrolled && (
          <section className="grid gap-2" aria-labelledby="sec-recovery">
            <div className="flex flex-wrap items-center gap-3">
              <KeyRound className="text-muted size-5" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 id="sec-recovery" className="text-sm font-medium">
                  {t("recovery.title")}
                </h3>
                <p className={s.recovery_codes_remaining <= 2 ? "text-warning text-sm" : "text-muted text-sm"}>
                  {t("recovery.remaining", { count: s.recovery_codes_remaining })}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={locked}
                loading={regenerate.isPending}
                onClick={() => window.confirm(t("recovery.regenerateConfirm")) && regenerate.mutate()}
              >
                {t("recovery.regenerate")}
              </Button>
            </div>
          </section>
        )}
      </CardContent>
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog === "totp" && (
          <DialogContent title={t("totp.setupTitle")}>
            <TOTPSetup onDone={() => setDialog(null)} />
          </DialogContent>
        )}
        {dialog !== null && dialog !== "totp" && (
          <DialogContent title={t("recovery.newTitle")}>
            <RecoveryCodes
              codes={dialog.codes}
              onDone={() => {
                setDialog(null);
                void refresh();
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}

function PasskeyRow({ passkey, locked }: { passkey: Schemas["Passkey"]; locked: boolean }) {
  const t = useTranslations("security.passkeys");
  const f = useFormat();
  const now = useNow();
  const errorText = useErrorText();
  const refresh = useRefreshSecurity();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(passkey.name);
  const rename = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH("/v1/me/security/passkeys/{id}", {
          params: { path: { id: passkey.id } },
          body: { name: name.trim() },
        }),
      ),
    meta: { silent: true },
    onSuccess: () => {
      setEditing(false);
      void refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrapEmpty(api.DELETE("/v1/me/security/passkeys/{id}", { params: { path: { id: passkey.id } } })),
    meta: { silent: true },
    onSuccess: () => {
      void refresh();
      toast.success(t("removed"));
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return (
    <li className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3">
      {editing ? (
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate();
          }}
        >
          <Input
            value={name}
            maxLength={60}
            autoFocus
            aria-label={t("name")}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" size="sm" loading={rename.isPending} disabled={!name.trim()}>
            {t("save")}
          </Button>
        </form>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {passkey.name} {passkey.synced && <Badge tone="info">{t("synced")}</Badge>}
          </p>
          <p className="text-muted text-xs">
            {passkey.last_used_at
              ? t("lastUsed", { when: f.relative(passkey.last_used_at, now || Date.now()) })
              : t("neverUsed")}
          </p>
        </div>
      )}
      {!editing && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("rename", { name: passkey.name })}
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden />
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={locked}
        aria-label={t("remove", { name: passkey.name })}
        onClick={() => window.confirm(t("removeConfirm", { name: passkey.name })) && remove.mutate()}
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------

/** "Chrome on Windows" in the viewer's language; the API sends the proper names. */
export function useDeviceLabel() {
  const t = useTranslations("security.sessions");
  return (d: Schemas["Device"]) =>
    d.browser && d.os ? t("deviceOn", { browser: d.browser, os: d.os }) : d.browser || d.os || t("unknownDevice");
}

function useCountryName() {
  const locale = useLocale();
  return (code: string | null | undefined) => {
    if (!code) return null;
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
}

function SessionsCard() {
  const t = useTranslations("security.sessions");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const router = useRouter();
  const errorText = useErrorText();
  const refresh = useRefreshSecurity();
  const device = useDeviceLabel();
  const country = useCountryName();
  const q = useSessions();
  const revoke = useMutation({
    mutationFn: (s: Session) =>
      unwrapEmpty(api.DELETE("/v1/me/sessions/{id}", { params: { path: { id: s.id } } })).then(() => s),
    meta: { silent: true },
    onSuccess: (s) => {
      if (s.current) {
        qc.clear();
        router.replace("/login");
        return;
      }
      void refresh();
      toast.success(t("signedOut"));
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const others = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/me/sessions/revoke-others")),
    meta: { silent: true },
    onSuccess: (r) => {
      track("security.sessions.revoked_others", { count: r.revoked });
      void refresh();
      toast.success(t("signedOutOthers", { count: r.revoked }));
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const rows = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        {rows.length > 1 && (
          <Button
            size="sm"
            variant="secondary"
            loading={others.isPending}
            onClick={() => window.confirm(t("signOutOthersConfirm")) && others.mutate()}
          >
            <LogOut aria-hidden />
            {t("signOutOthers")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ul className="grid gap-2">
            {rows.map((s) => (
              <li key={s.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {device(s.device)}
                    {s.current && <Badge tone="primary">{t("thisDevice")}</Badge>}
                    {s.mfa && (
                      <Badge tone="success">
                        <ShieldCheck aria-hidden />
                        {t("verified")}
                      </Badge>
                    )}
                    {s.remembered && <Badge>{t("remembered")}</Badge>}
                  </p>
                  <p className="text-muted text-xs">
                    {[
                      t(`method.${s.auth_method}`),
                      country(s.country),
                      s.current
                        ? t("activeNow")
                        : t("lastSeen", { when: f.relative(s.last_seen_at, now || Date.now()) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    {s.ip && (
                      <span dir="ltr" className="font-mono">
                        {s.ip}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={revoke.isPending && revoke.variables?.id === s.id}
                  onClick={() => (!s.current || window.confirm(t("signOutThisConfirm"))) && revoke.mutate(s)}
                >
                  {t("signOut")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

function AlertsCard({ s }: { s: SecurityOverview }) {
  const t = useTranslations("security.alerts");
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const refresh = useRefreshSecurity();
  const on = me?.user.login_alerts ?? s.login_alerts;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="login-alerts" className="text-sm font-medium">
              {t("label")}
            </label>
            <p className="text-muted text-sm">{s.has_email ? t("hint") : t("noEmail")}</p>
          </div>
          <Switch
            id="login-alerts"
            checked={s.has_email && on}
            disabled={!s.has_email}
            onCheckedChange={(v) => updateMe.mutate({ login_alerts: v }, { onSuccess: () => void refresh() })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityCard({ s }: { s: SecurityOverview }) {
  const t = useTranslations("security.activity");
  const f = useFormat();
  const now = useNow();
  const device = useDeviceLabel();
  const country = useCountryName();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {s.recent_events.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <ul className="grid gap-2 text-sm">
            {s.recent_events.map((e) => {
              const d = e.detail as { new_device?: boolean; new_country?: boolean };
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{t(`kind.${e.kind}`)}</span>
                  {d.new_device && <Badge tone="warning">{t("newDevice")}</Badge>}
                  {d.new_country && <Badge tone="warning">{t("newCountry")}</Badge>}
                  <span className="text-muted text-xs">
                    {[device(e.device), country(e.country)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-muted ms-auto text-xs">{f.relative(e.created_at, now || Date.now())}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
