"use client";

import { Copy, Download, Globe, KeyRound, RefreshCw, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { SandboxCard } from "@/features/sandbox";
import { SLACard } from "@/features/status";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import {
  type MappableRole,
  type SAMLSPCert,
  type SCIMTokenCreated,
  type SSOConnectionInput,
  type SSODomain,
  type SSOGroupMapping,
  useDeleteConnection,
  useDomainActions,
  useMapGroupRole,
  useRotateSPKey,
  useSaveConnection,
  useSCIMTokens,
  useSSOConnection,
  useSSODomains,
  useSSOGroups,
  useTokenActions,
} from "../api";

import { AccessPolicyCard } from "./access-policy";
import { AuditStreamsCard } from "./audit-streams";
import { CopyValue, useCopy } from "./copy-value";
import { EncryptionKeysCard } from "./encryption-keys";
import { WarehouseExportsCard } from "./warehouse-exports";

/** Settings › Single sign-on (G7a): domains, the identity provider, enforcement and SCIM provisioning. */
export function SSOSettings() {
  const canEdit = useCan("agency.update");
  const t = useTranslations("sso");
  if (!canEdit) return <p className="text-muted text-sm">{t("adminsOnly")}</p>;
  return (
    <div className="grid gap-4">
      <Domains />
      <Connection />
      <ScimTokens />
      <GroupRoles />
      <AccessPolicyCard />
      <EncryptionKeysCard />
      <AuditStreamsCard />
      <WarehouseExportsCard />
      <SandboxCard />
      <SLACard />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function DomainStatus({ status }: { status: SSODomain["status"] }) {
  const t = useTranslations("sso.domains");
  const tone = status === "verified" ? "success" : status === "failed" ? "danger" : "neutral";
  return <Badge tone={tone}>{t(`status.${status}`)}</Badge>;
}

function Domains() {
  const t = useTranslations("sso.domains");
  const q = useSSODomains();
  const { add, verify, remove } = useDomainActions();
  const [domain, setDomain] = useState("");
  const [err, setErr] = useState<string>();
  const rows = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!domain.trim()) return;
            add.mutate(domain.trim(), {
              onSuccess: () => {
                track("sso.domain.added");
                setDomain("");
                setErr(undefined);
              },
              onError: (e) => setErr(isApiError(e) && e.code === "plan_limit" ? t("errors.plan") : t("errors.invalid")),
            });
          }}
        >
          <Field label={t("domain")} error={err} className="min-w-60 flex-1">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="youragency.com"
              maxLength={253}
              dir="ltr"
            />
          </Field>
          <Button type="submit" loading={add.isPending}>
            {t("add")}
          </Button>
        </form>
        {q.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="grid gap-3" data-testid="sso-domains">
            {rows.map((d) => (
              <li key={d.id} className="border-border grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="font-medium break-all">
                    {d.domain}
                  </span>
                  <DomainStatus status={d.status} />
                  <span className="ms-auto flex gap-1">
                    {d.status !== "verified" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={verify.isPending && verify.variables === d.id}
                        onClick={() =>
                          verify.mutate(d.id, {
                            onSuccess: (r) =>
                              r.status === "verified" ? toast.success(t("verified")) : toast.error(t("notYet")),
                            onError: (e) =>
                              toast.error(
                                isApiError(e) && e.code === "sso_domain_taken" ? t("errors.taken") : t("failed"),
                              ),
                          })
                        }
                      >
                        <RefreshCw aria-hidden />
                        {t("verify")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("remove", { name: d.domain })}
                      onClick={() => {
                        if (window.confirm(t("removeConfirm", { name: d.domain }))) remove.mutate(d.id);
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </div>
                {d.status !== "verified" && (
                  <div className="grid gap-2">
                    <p className="text-muted text-xs">{t("addRecord")}</p>
                    <CopyValue label={t("recordName")} value={d.record_name} />
                    <CopyValue label={t("recordValue")} value={d.record_value} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

type Form = Required<Omit<SSOConnectionInput, "default_role">> & { default_role: "admin" | "manager" | "agent" };

const EMPTY: Form = {
  protocol: "oidc",
  enabled: true,
  enforce: false,
  jit: true,
  default_role: "agent",
  oidc_issuer: "",
  oidc_client_id: "",
  oidc_client_secret: "",
  saml_idp_entity_id: "",
  saml_idp_sso_url: "",
  saml_idp_cert: "",
  saml_sign_requests: true,
  saml_allow_idp_initiated: false,
};

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-hint`} />
    </div>
  );
}

/** The agency's SAML service-provider certificate (G7d): for providers that verify signed requests or encrypt. */
function SPCertificate({ cert }: { cert: SAMLSPCert }) {
  const t = useTranslations("sso.connection.spCert");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const copy = useCopy();
  const rotate = useRotateSPKey();
  const download = () => {
    const url = URL.createObjectURL(new Blob([cert.pem], { type: "application/x-pem-file" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leadexpa-saml-sp.pem";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="bg-surface-2 grid gap-2 rounded-lg p-3" data-testid="sp-cert">
      <p className="text-sm font-medium">{t("title")}</p>
      <p className="text-muted text-xs">{t("hint")}</p>
      <CopyValue label={t("fingerprint")} value={cert.fingerprint_sha256} />
      <span className="text-muted text-xs">{t("expires", { when: fmt.dateTime(cert.expires_at, tz, "date") })}</span>
      {cert.previous_key_active && cert.rotated_at && (
        <p className="text-muted text-xs">{t("previousActive", { when: fmt.dateTime(cert.rotated_at, tz) })}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => copy(cert.pem)}>
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={download}>
          <Download aria-hidden />
          {t("download")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          loading={rotate.isPending}
          onClick={() => {
            if (!window.confirm(t("rotateConfirm"))) return;
            rotate.mutate(undefined, {
              onSuccess: () => {
                track("sso.sp_key.rotated");
                toast.success(t("rotated"));
              },
              onError: (e) => toast.error(isApiError(e) && e.code === "plan_limit" ? t("plan") : t("failed")),
            });
          }}
        >
          <RefreshCw aria-hidden />
          {t("rotate")}
        </Button>
      </div>
    </div>
  );
}

function Connection() {
  const t = useTranslations("sso.connection");
  const tr = useTranslations("roles");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const q = useSSOConnection();
  const save = useSaveConnection();
  const del = useDeleteConnection();
  const verified = (useSSODomains().data?.data ?? []).some((d) => d.status === "verified");
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const conn = q.data?.connection ?? null;
  useEffect(() => {
    if (!conn) return;
    setF({
      protocol: conn.protocol,
      enabled: conn.enabled,
      enforce: conn.enforce,
      jit: conn.jit,
      default_role: conn.default_role,
      oidc_issuer: conn.oidc_issuer,
      oidc_client_id: conn.oidc_client_id,
      oidc_client_secret: "",
      saml_idp_entity_id: conn.saml_idp_entity_id,
      saml_idp_sso_url: conn.saml_idp_sso_url,
      saml_idp_cert: conn.saml_idp_cert,
      saml_sign_requests: conn.saml_sign_requests,
      saml_allow_idp_initiated: conn.saml_allow_idp_initiated,
    });
  }, [conn]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  const sp = q.data?.sp;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.enforce && !conn?.enforce && !window.confirm(t("enforceConfirm"))) return;
    setErrors({});
    setFormError(undefined);
    save.mutate(f, {
      onSuccess: () => {
        track("sso.connection.saved", { protocol: f.protocol, enforce: f.enforce });
        toast.success(t("saved"));
        set("oidc_client_secret", "");
      },
      onError: (e) => {
        if (!isApiError(e)) return setFormError(t("failed"));
        if (e.code === "plan_limit") return setFormError(t("plan"));
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.fieldErrors)) fe[k] = v.message;
        setErrors(fe);
        if (!Object.keys(fe).length) setFormError(e.message);
      },
    });
  };
  // Beside the issuer for OIDC; on its own row for SAML, which has no issuer.
  const roleField = (
    <Field label={t("defaultRole")} hint={t("defaultRoleHint")}>
      <NativeSelect
        value={f.default_role}
        onChange={(e) => set("default_role", e.target.value as Form["default_role"])}
      >
        {(["agent", "manager", "admin"] as const).map((r) => (
          <option key={r} value={r}>
            {tr(r)}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-accent size-5" aria-hidden />
          {t("title")}
          {conn && <Badge tone={conn.enabled ? "success" : "neutral"}>{conn.enabled ? t("on") : t("off")}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <p className="text-muted text-sm">{t("hint")}</p>
          {!verified && <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm">{t("needDomain")}</p>}
          {formError && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {formError}
            </p>
          )}
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Field label={t("protocol")}>
              <NativeSelect value={f.protocol} onChange={(e) => set("protocol", e.target.value as Form["protocol"])}>
                <option value="oidc">{t("oidc")}</option>
                <option value="saml">{t("saml")}</option>
              </NativeSelect>
            </Field>
            {sp && (
              <div className="grid min-w-0 gap-2">
                <p className="text-sm font-medium">{t("enterInIdP")}</p>
                {f.protocol === "oidc" ? (
                  <CopyValue label={t("redirectURL")} value={sp.oidc_redirect_url} />
                ) : (
                  <>
                    <CopyValue label={t("entityID")} value={sp.saml_entity_id} />
                    <CopyValue label={t("acsURL")} value={sp.saml_acs_url} />
                    <CopyValue label={t("metadataURL")} value={sp.saml_metadata_url} />
                    {!conn?.saml_sp_cert && <p className="text-muted text-xs">{t("spCertAfterSave")}</p>}
                  </>
                )}
              </div>
            )}
          </div>
          {f.protocol === "oidc" ? (
            <>
              <div className="grid items-start gap-4 sm:grid-cols-[1fr_14rem]">
                <Field label={t("issuer")} hint={t("issuerHint")} error={errors.oidc_issuer}>
                  <Input
                    dir="ltr"
                    value={f.oidc_issuer}
                    placeholder="https://login.microsoftonline.com/…/v2.0"
                    onChange={(e) => set("oidc_issuer", e.target.value)}
                  />
                </Field>
                {roleField}
              </div>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <Field label={t("clientID")} error={errors.oidc_client_id}>
                  <Input dir="ltr" value={f.oidc_client_id} onChange={(e) => set("oidc_client_id", e.target.value)} />
                </Field>
                <Field
                  label={t("clientSecret")}
                  hint={conn?.oidc_client_secret_set ? t("secretKept") : undefined}
                  error={errors.oidc_client_secret}
                >
                  <Input
                    type="password"
                    autoComplete="off"
                    dir="ltr"
                    value={f.oidc_client_secret}
                    onChange={(e) => set("oidc_client_secret", e.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label={t("idpEntityID")} error={errors.saml_idp_entity_id}>
                <Input
                  dir="ltr"
                  value={f.saml_idp_entity_id}
                  onChange={(e) => set("saml_idp_entity_id", e.target.value)}
                />
              </Field>
              <Field label={t("idpSSOURL")} error={errors.saml_idp_sso_url}>
                <Input dir="ltr" value={f.saml_idp_sso_url} onChange={(e) => set("saml_idp_sso_url", e.target.value)} />
              </Field>
              <Field label={t("idpCert")} hint={t("idpCertHint")} error={errors.saml_idp_cert}>
                <Textarea
                  dir="ltr"
                  rows={5}
                  className="font-mono text-xs"
                  value={f.saml_idp_cert}
                  onChange={(e) => set("saml_idp_cert", e.target.value)}
                />
              </Field>
              <Toggle
                label={t("signRequests")}
                hint={t("signRequestsHint")}
                checked={f.saml_sign_requests}
                onChange={(v) => set("saml_sign_requests", v)}
              />
              <Toggle
                label={t("idpInitiated")}
                hint={t("idpInitiatedHint")}
                checked={f.saml_allow_idp_initiated}
                onChange={(v) => set("saml_allow_idp_initiated", v)}
              />
              {conn?.saml_sp_cert && f.protocol === conn.protocol && <SPCertificate cert={conn.saml_sp_cert} />}
            </>
          )}
          <div className="grid gap-3">
            <Toggle
              label={t("enabled")}
              hint={t("enabledHint")}
              checked={f.enabled}
              onChange={(v) => set("enabled", v)}
            />
            <Toggle label={t("jit")} hint={t("jitHint")} checked={f.jit} onChange={(v) => set("jit", v)} />
            <Toggle
              label={t("enforce")}
              hint={t("enforceHint")}
              checked={f.enforce}
              onChange={(v) => set("enforce", v)}
            />
          </div>
          {f.protocol === "saml" && <div className="sm:w-56">{roleField}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
            {conn && (
              <Button
                type="button"
                variant="ghost"
                loading={del.isPending}
                onClick={() => {
                  if (window.confirm(t("removeConfirm"))) del.mutate(undefined, { onSuccess: () => setF(EMPTY) });
                }}
              >
                <Trash2 aria-hidden />
                {t("remove")}
              </Button>
            )}
            {conn && (
              <span className="text-muted ms-auto text-xs">
                {t("updated", { when: fmt.dateTime(conn.updated_at, tz) })}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

function ScimTokens() {
  const t = useTranslations("sso.scim");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const copy = useCopy();
  const q = useSCIMTokens();
  const { create, revoke } = useTokenActions();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<SCIMTokenCreated | null>(null);
  const rows = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate(name.trim(), {
              onSuccess: (r) => {
                track("sso.scim_token.created");
                setCreated(r);
                setName("");
              },
            });
          }}
        >
          <Field label={t("name")} className="min-w-52 flex-1">
            <Input value={name} maxLength={80} placeholder="Okta" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" loading={create.isPending}>
            <KeyRound aria-hidden />
            {t("create")}
          </Button>
        </form>
        {created && (
          <div
            className="border-primary bg-primary-soft grid gap-2 rounded-lg border p-3"
            data-testid="scim-token-created"
          >
            <p className="text-sm font-medium">{t("shownOnce")}</p>
            <CopyValue label={t("baseURL")} value={created.base_url} />
            <CopyValue label={t("token")} value={created.token} />
            <div>
              <Button size="sm" variant="secondary" onClick={() => (copy(created.token), setCreated(null))}>
                {t("copiedDone")}
              </Button>
            </div>
          </div>
        )}
        {q.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="divide-border grid divide-y" data-testid="scim-tokens">
            {rows.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{k.name}</span>
                <span className="text-muted text-xs">
                  {k.last_used_at ? t("lastUsed", { when: fmt.dateTime(k.last_used_at, tz) }) : t("neverUsed")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  aria-label={t("revoke", { name: k.name })}
                  onClick={() => {
                    if (window.confirm(t("revokeConfirm", { name: k.name }))) revoke.mutate(k.id);
                  }}
                >
                  <Trash2 aria-hidden />
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

const MAPPABLE: MappableRole[] = ["agent", "manager", "admin"];

function GroupRoleSelect({ group }: { group: SSOGroupMapping }) {
  const t = useTranslations("sso.groups");
  const tr = useTranslations("roles");
  const map = useMapGroupRole();
  const pending = map.isPending && map.variables?.id === group.id;
  return (
    <NativeSelect
      aria-label={t("role", { name: group.display_name })}
      className="w-40"
      value={group.role ?? ""}
      disabled={pending}
      onChange={(e) => {
        const role = (e.target.value || null) as MappableRole | null;
        if (group.member_count > 0 && !window.confirm(t("confirm", { name: group.display_name }))) return;
        map.mutate(
          { id: group.id, role },
          {
            onSuccess: () => {
              track("sso.group_role.mapped", { role: role ?? "none" });
              toast.success(
                role
                  ? t("saved", { name: group.display_name, role: tr(role) })
                  : t("cleared", { name: group.display_name }),
              );
            },
            onError: (e) => toast.error(isApiError(e) && e.code === "plan_limit" ? t("plan") : t("failed")),
          },
        );
      }}
    >
      <option value="">{t("unmapped")}</option>
      {MAPPABLE.map((r) => (
        <option key={r} value={r}>
          {tr(r)}
        </option>
      ))}
    </NativeSelect>
  );
}

/** The groups the identity provider pushed over SCIM and the role each one grants (G7c). */
function GroupRoles() {
  const t = useTranslations("sso.groups");
  const q = useSSOGroups();
  const rows = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        {q.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="divide-border grid divide-y" data-testid="sso-groups">
            {rows.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="grid gap-0.5">
                  <span className="font-medium break-all">{g.display_name}</span>
                  <span className="text-muted text-xs">{t("members", { count: g.member_count })}</span>
                </span>
                <span className="ms-auto">
                  <GroupRoleSelect group={g} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
