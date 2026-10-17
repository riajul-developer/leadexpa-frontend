"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, ShieldCheck, UserPlus, UserX } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BillingPage } from "@/features/billing";
import { CallSettingsPage } from "@/features/calls";
import { MemberSkillsCard } from "@/features/clients";
import { MessagingSettings } from "@/features/conversations";
import { NotificationPreferences } from "@/features/notifications";
import { SecuritySettings } from "@/features/security";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { NATIVE_DIGITS, toApiLocale, type AppLocale } from "@/shared/config/locales";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { toLatinDigits } from "@/shared/lib/format";
import { lookupKeys, useClients, useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone, usePreferences } from "@/shared/lib/preferences";
import { meKey, useCan, useMe } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { useUpdateMe } from "@/shared/lib/update-me";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { CountrySelect, LocaleSelect, TimeZoneSelect } from "@/shared/ui/locale-fields";
import { Dialog, DialogContent, Switch } from "@/shared/ui/overlays";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { SETTINGS_TABS, type SettingsTab } from "../tabs";

const TAB_PERMISSION: Partial<Record<SettingsTab, string>> = {
  agency: "agency.update",
  team: "member.read",
  scoring: "lead.read",
  branding: "agency.read",
  billing: "agency.read",
  "audit-log": "audit.read",
  messaging: "activity.create",
  calls: "activity.create",
  developer: "integration.manage",
  sso: "agency.update",
  group: "agency.read",
};

// Lead scoring (17.7) loads on first visit.
const ScoringSettings = dynamic(() => import("@/features/scoring").then((m) => m.ScoringSettings), {
  loading: () => <Skeleton className="h-64 w-full" />,
});

// White-label branding (8f) loads on first visit.
const BrandingSettings = dynamic(() => import("@/features/portal").then((m) => m.BrandingSettings), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

// Calendar connection (10.1) loads on first visit.
const CalendarSettings = dynamic(() => import("@/features/appointments").then((m) => m.CalendarSettings), {
  loading: () => <Skeleton className="h-40 w-full" />,
});

// Single sign-on and SCIM (G7a) load on first visit: only owners and admins see the tab.
const SSOSettings = dynamic(() => import("@/features/sso").then((m) => m.SSOSettings), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

// Holding group (G7e) loads on first visit.
const GroupSettings = dynamic(() => import("@/features/groups").then((m) => m.GroupSettings), {
  loading: () => <Skeleton className="h-40 w-full" />,
});

// Developer settings load on first visit: most members never open them.
const DeveloperSettings = dynamic(() => import("@/features/developer").then((m) => m.DeveloperSettings), {
  loading: () => <Skeleton className="h-64 w-full" />,
});

export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const t = useTranslations("settings");
  const { data: me } = useMe();
  const perms = new Set(me?.permissions ?? []);
  const tabs = SETTINGS_TABS.filter((x) => !TAB_PERMISSION[x] || perms.has(TAB_PERMISSION[x]!));
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-[12rem_1fr]">
      <h1 className="text-xl font-semibold md:col-span-2">{t("title")}</h1>
      {/* Stays below the sticky app header (h-14) while the settings content scrolls. */}
      <nav
        aria-label={t("title")}
        className="flex gap-1 overflow-x-auto md:sticky md:top-18 md:max-h-[calc(100dvh-5.5rem)] md:flex-col md:self-start md:overflow-y-auto"
      >
        {tabs.map((x) => (
          <Link
            key={x}
            href={`/settings/${x}`}
            aria-current={tab === x ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm",
              tab === x ? "bg-primary-soft text-primary font-medium" : "text-muted hover:bg-surface-2",
            )}
          >
            {t(`tabs.${x}`)}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">
        {tab === "profile" && <ProfileSettings />}
        {tab === "security" && <SecuritySettings />}
        {tab === "sso" && <SSOSettings />}
        {tab === "group" && <GroupSettings />}
        {tab === "agency" && <AgencySettings />}
        {tab === "team" && <TeamSettings />}
        {tab === "notifications" && <NotificationPreferences />}
        {tab === "messaging" && <MessagingSettings />}
        {tab === "calls" && <CallSettingsPage />}
        {tab === "developer" && <DeveloperSettings />}
        {tab === "scoring" && <ScoringSettings />}
        {tab === "calendar" && <CalendarSettings />}
        {tab === "branding" && <BrandingSettings />}
        {tab === "billing" && <BillingPage />}
        {tab === "audit-log" && <AuditLog />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ProfileSettings() {
  const t = useTranslations("settings.profile");
  const qc = useQueryClient();
  const { data: me } = useMe();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { digits, analyticsConsent, setAnalyticsConsent } = usePreferences();
  const updateMe = useUpdateMe();
  const nativeDigits = NATIVE_DIGITS[locale as AppLocale];
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  const availability = useMutation({
    mutationFn: (v: "available" | "away") =>
      unwrapEmpty(api.POST("/v1/me/availability", { body: { availability: v } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKey }),
  });
  const reset = useMutation({
    mutationFn: () => unwrapEmpty(api.POST("/v1/auth/password/forgot", { body: { email: me!.user.email ?? "" } })),
    onSuccess: () => toast.success(t("resetSent")),
  });
  if (!me) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={me.user.name} />
            <div>
              <p className="font-medium">{me.user.name}</p>
              <p className="text-muted text-sm">
                {me.user.email}{" "}
                {me.user.email_verified ? (
                  <Badge tone="success">
                    <ShieldCheck aria-hidden />
                    {t("verified")}
                  </Badge>
                ) : (
                  <Badge tone="warning">{t("unverified")}</Badge>
                )}
              </p>
            </div>
          </div>
          {/* One row on wide screens: language (compact), the digits choice where the language has its own, clock,
              and timezone taking the rest. Two per row on tablets, stacked on phones. */}
          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2",
              nativeDigits
                ? "lg:grid-cols-[9.5rem_9.5rem_11rem_minmax(0,1fr)]"
                : "lg:grid-cols-[10rem_12rem_minmax(0,1fr)]",
            )}
          >
            <Field label={t("language")}>
              <LocaleSelect
                value={locale}
                onValueChange={(l) => {
                  updateMe.mutate({ locale: toApiLocale(l) });
                  router.replace(pathname, { locale: l });
                }}
              />
            </Field>
            {nativeDigits && (
              <Field label={t("digits")} hint={t("digitsHint")}>
                <NativeSelect
                  value={digits}
                  onChange={(e) => updateMe.mutate({ number_system: e.target.value as "latn" | "native" })}
                >
                  <option value="latn">0123456789</option>
                  <option value="native">{nativeDigits}</option>
                </NativeSelect>
              </Field>
            )}
            <Field label={t("clock")}>
              <NativeSelect
                value={me.user.hour_cycle ?? ""}
                onChange={(e) => updateMe.mutate({ hour_cycle: (e.target.value || null) as "h12" | "h23" | null })}
              >
                <option value="">{t("clockAuto")}</option>
                <option value="h12">{t("clock12")}</option>
                <option value="h23">{t("clock24")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("timezone")} hint={t("timezoneHint")}>
              <NativeSelect
                value={me.user.timezone ?? ""}
                onChange={(e) => updateMe.mutate({ timezone: e.target.value || null })}
              >
                <option value="">{t("timezoneAgency", { zone: me.agency?.default_timezone ?? "" })}</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="away" className="text-sm font-medium">
                {t("away")}
              </label>
              <p className="text-muted text-sm">{t("awayHint")}</p>
            </div>
            <Switch
              id="away"
              checked={me.availability === "away"}
              onCheckedChange={(v) => availability.mutate(v ? "away" : "available")}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="consent" className="text-sm font-medium">
                {t("analytics")}
              </label>
              <p className="text-muted text-sm">{t("analyticsHint")}</p>
            </div>
            <Switch id="consent" checked={analyticsConsent === true} onCheckedChange={setAnalyticsConsent} />
          </div>
          {me.user.email && (
            <div>
              <Button variant="secondary" onClick={() => reset.mutate()} loading={reset.isPending}>
                <Mail aria-hidden />
                {t("changePassword")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function AgencySettings() {
  const t = useTranslations("settings.agency");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["agency"], queryFn: () => unwrap(api.GET("/v1/agencies/current")) });
  const [draft, setDraft] = useState<Schemas["AgencyPatch"] | null>(null);
  useEffect(() => {
    if (q.data)
      setDraft({
        name: q.data.name,
        country: q.data.country,
        default_locale: q.data.default_locale,
        default_timezone: q.data.default_timezone,
        default_currency: q.data.default_currency,
        reporting_currency: q.data.reporting_currency,
      });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => unwrap(api.PATCH("/v1/agencies/current", { body: draft! })),
    onSuccess: (a) => {
      qc.setQueryData(["agency"], a);
      void qc.invalidateQueries({ queryKey: meKey });
      toast.success(t("saved"));
    },
  });
  if (!draft) return <Skeleton className="h-64 w-full" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label={t("name")} className="sm:col-span-6">
            <Input
              value={draft.name ?? ""}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label={t("country")} hint={t("countryHint")} className="sm:col-span-3">
            <CountrySelect value={draft.country ?? ""} onValueChange={(country) => setDraft({ ...draft, country })} />
          </Field>
          <Field label={t("timezone")} className="sm:col-span-3">
            <TimeZoneSelect
              value={draft.default_timezone ?? "UTC"}
              onValueChange={(default_timezone) => setDraft({ ...draft, default_timezone })}
            />
          </Field>
          <Field label={t("locale")} className="sm:col-span-2">
            <LocaleSelect
              value={draft.default_locale ?? "en"}
              onValueChange={(l) => setDraft({ ...draft, default_locale: toApiLocale(l) })}
            />
          </Field>
          <Field label={t("currency")} className="sm:col-span-2">
            <Input
              value={draft.default_currency ?? ""}
              maxLength={3}
              onChange={(e) => setDraft({ ...draft, default_currency: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label={t("reportingCurrency")} className="sm:col-span-2">
            <Input
              value={draft.reporting_currency ?? ""}
              maxLength={3}
              onChange={(e) => setDraft({ ...draft, reporting_currency: e.target.value.toUpperCase() })}
            />
          </Field>
          <div className="flex justify-end sm:col-span-6">
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
        {q.data && <AdminMFAPolicy agency={q.data} />}
      </CardContent>
    </Card>
  );
}

/** Owners and admins must use two-step sign-in (17.6). Saved on toggle, separately from the form. */
function AdminMFAPolicy({ agency }: { agency: Schemas["Agency"] }) {
  const t = useTranslations("settings.agency");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: (on: boolean) => unwrap(api.PATCH("/v1/agencies/current", { body: { require_admin_mfa: on } })),
    meta: { silent: true },
    onSuccess: (a) => {
      qc.setQueryData(["agency"], a);
      void qc.invalidateQueries({ queryKey: meKey });
      track("security.policy.changed", { require_admin_mfa: a.require_admin_mfa });
      toast.success(a.require_admin_mfa ? t("mfaOn") : t("mfaOff"));
    },
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("network")),
  });
  return (
    <div className="border-border mt-6 flex items-center justify-between gap-4 border-t pt-4">
      <div>
        <label htmlFor="require-mfa" className="text-sm font-medium">
          {t("requireMfa")}
        </label>
        <p className="text-muted text-sm">
          {t("requireMfaHint")}{" "}
          <Link href="/settings/security" className="text-primary">
            {t("requireMfaSetup")}
          </Link>
        </p>
      </div>
      <Switch
        id="require-mfa"
        checked={set.isPending ? set.variables : agency.require_admin_mfa}
        disabled={set.isPending}
        onCheckedChange={(v) => set.mutate(v)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

const ROLE_ORDER: Schemas["Role"][] = ["owner", "admin", "manager", "agent", "client_agent", "client_viewer"];

function TeamSettings() {
  const t = useTranslations("settings.team");
  const tr = useTranslations("roles");
  const trd = useTranslations("roleDescriptions");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canManage = useCan("member.manage");
  const canInvite = useCan("invite.manage");
  const canRoute = useCan("client.manage");
  const { members, isPending } = useMembers();
  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: () => unwrap(api.GET("/v1/invites")),
    enabled: canInvite,
  });
  const [inviting, setInviting] = useState(false);
  const myRank = ROLE_ORDER.indexOf(me?.membership?.role ?? "client_viewer");
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Schemas["Role"] }) =>
      unwrap(api.PATCH("/v1/members/{memberId}", { params: { path: { memberId: id } }, body: { role } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.members }),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/v1/members/{memberId}", { params: { path: { memberId: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.members }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      unwrapEmpty(api.DELETE("/v1/invites/{inviteId}", { params: { path: { inviteId: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          {canInvite && (
            <Button size="sm" onClick={() => setInviting(true)}>
              <UserPlus aria-hidden />
              {t("invite")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ul className="grid gap-2">
              {members.map((m) => {
                const editable =
                  canManage &&
                  m.user.id !== me?.user.id &&
                  ROLE_ORDER.indexOf(m.role) > myRank &&
                  m.status === "active";
                return (
                  <li key={m.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <Avatar name={m.user.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {m.user.name}
                        {m.user.id === me?.user.id && <span className="text-muted"> ({t("you")})</span>}
                      </p>
                      <p className="text-muted truncate text-sm" dir="ltr">
                        {m.user.email ?? m.user.phone}
                      </p>
                    </div>
                    {m.status === "deactivated" ? (
                      <Badge>{t("deactivated")}</Badge>
                    ) : editable ? (
                      <NativeSelect
                        className="h-8 w-auto"
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value as Schemas["Role"] })}
                        aria-label={t("roleFor", { name: m.user.name })}
                      >
                        {ROLE_ORDER.filter((r) => ROLE_ORDER.indexOf(r) > myRank).map((r) => (
                          <option key={r} value={r}>
                            {tr(r)}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Badge tone="primary">{tr(m.role)}</Badge>
                    )}
                    {editable && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("deactivate", { name: m.user.name })}
                        onClick={() =>
                          window.confirm(t("deactivateConfirm", { name: m.user.name })) && deactivate.mutate(m.id)
                        }
                      >
                        <UserX aria-hidden />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {canRoute && <MemberSkillsCard />}
      {canInvite && (invites.data?.data.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pending")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {invites.data!.data.map((i) => (
                <li key={i.id} className="border-border flex items-center gap-2 rounded-lg border p-2">
                  <span className="min-w-0 flex-1 truncate" dir="ltr">
                    {i.email ?? i.phone}
                  </span>
                  <Badge>{tr(i.role)}</Badge>
                  <span className="text-muted text-xs">
                    {t("expires", { when: f.relative(i.expires_at, now || Date.now()) })}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                    {t("revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("rolesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            {ROLE_ORDER.map((r) => (
              <div key={r}>
                <dt className="font-medium">{tr(r)}</dt>
                <dd className="text-muted">{trd(r)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings.team");
  const tr = useTranslations("roles");
  const trd = useTranslations("roleDescriptions");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const { clients } = useClients();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Schemas["InvitableRole"]>("agent");
  // Client staff (17.0.3) belong to one client and are usually invited by phone (SMS link, no password).
  const clientRole = role === "client_agent" || role === "client_viewer";
  const [by, setBy] = useState<"email" | "phone">("email");
  const [clientId, setClientId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/invites", {
          body: {
            role,
            ...(by === "phone" ? { phone: toLatinDigits(phone).trim() } : { email: email.trim() }),
            ...(clientRole ? { client_id: clientId } : {}),
          },
        }),
      ),
    meta: { silent: true },
    onSuccess: (r) => {
      track("team.invite.sent", { role, by });
      void qc.invalidateQueries({ queryKey: ["invites"] });
      setLink(r.accept_url);
    },
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("validation_failed")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("invite")}>
        {link ? (
          <div className="grid gap-3">
            <p className="text-sm">{t("sent", { email: by === "phone" ? phone : email })}</p>
            <p className="text-muted text-sm">{t("shareLink")}</p>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t("link")} />
              <Button
                variant="secondary"
                size="icon"
                aria-label={t("copy")}
                onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success(t("copied")))}
              >
                <Copy aria-hidden />
              </Button>
            </div>
            <Button onClick={onClose}>{t("done")}</Button>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate();
            }}
          >
            <Field label={t("role")} hint={trd(role)}>
              <NativeSelect
                value={role}
                onChange={(e) => {
                  const r = e.target.value as Schemas["InvitableRole"];
                  setRole(r);
                  if (r === "client_agent") setBy("phone");
                }}
              >
                {(["admin", "manager", "agent", "client_agent", "client_viewer"] as const).map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {clientRole && (
              <Field label={t("client")} hint={t("clientHint")}>
                <NativeSelect required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">—</option>
                  {clients
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            )}
            <div className="flex gap-2" role="radiogroup" aria-label={t("inviteBy")}>
              {(["email", "phone"] as const).map((b) => (
                <Button
                  key={b}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={by === b}
                  variant={by === b ? "primary" : "secondary"}
                  onClick={() => setBy(b)}
                >
                  {t(b === "email" ? "byEmail" : "byPhone")}
                </Button>
              ))}
            </div>
            {by === "email" ? (
              <Field label={t("email")}>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            ) : (
              <Field label={t("phone")} hint={t("phoneHint")}>
                <Input
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={invite.isPending} disabled={clientRole && !clientId}>
                {t("send")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------

function Diff({ before, after }: { before: unknown; after: unknown }) {
  const t = useTranslations("settings.audit");
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const show = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));
  if (keys.length === 0) return <p className="text-muted text-xs">{t("noChanges")}</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted text-start">
          <th scope="col" className="py-1 font-medium">
            {t("field")}
          </th>
          <th scope="col" className="py-1 font-medium">
            {t("before")}
          </th>
          <th scope="col" className="py-1 font-medium">
            {t("after")}
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const changed = JSON.stringify(b[k]) !== JSON.stringify(a[k]);
          return (
            <tr key={k} className={cn("border-border border-t", changed && "bg-warning-soft/40")}>
              <th scope="row" className="py-1 pe-2 text-start font-mono font-normal">
                {k}
              </th>
              <td className="text-muted py-1 pe-2 break-all">{show(b[k])}</td>
              <td className="py-1 break-all">{show(a[k])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AuditLog() {
  const t = useTranslations("settings.audit");
  const f = useFormat();
  const displayTz = useDisplayTimeZone();
  const { byUserId } = useMembers();
  const [action, setAction] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(action.trim()), 300);
    return () => clearTimeout(id);
  }, [action]);
  const q = useInfiniteQuery({
    queryKey: ["audit", debounced],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/audit-logs", {
          params: { query: { action: debounced || undefined, cursor: pageParam, limit: 50 } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.next_cursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  const tz = displayTz;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <Input
          className="w-56"
          placeholder={t("filter")}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label={t("filter")}
        />
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={r.id}>
                <details className="border-border rounded-lg border p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <code className="bg-surface-2 rounded px-1.5 py-0.5 text-xs">{r.action}</code>
                    <span>
                      {r.actor_user_id
                        ? (byUserId.get(r.actor_user_id)?.user.name ?? r.actor_user_id.slice(0, 8))
                        : t("system")}
                    </span>
                    <span className="text-muted ms-auto text-xs">{f.dateTime(r.at, tz)}</span>
                  </summary>
                  <div className="mt-2 grid gap-1">
                    <p className="text-muted text-xs">
                      {r.resource_type} · {r.resource_id} · {r.actor_ip}
                    </p>
                    <Diff before={r.before} after={r.after} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        {q.hasNextPage && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
              {t("more")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
