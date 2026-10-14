"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Copy, Globe, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import type { components } from "@/shared/lib/api/schema";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

type DNSRecord = components["schemas"]["DNSRecord"];
type Status = "pending" | "verified" | "failed";

const domainsKey = ["custom-domains"] as const;
const sendersKey = ["sender-domains"] as const;

function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("portal.domains");
  const tone = status === "verified" ? "success" : status === "failed" ? "danger" : "neutral";
  return <Badge tone={tone}>{t(`status.${status}`)}</Badge>;
}

/** The DNS records to add, each with a copy button and whether it was found. */
function Records({ records }: { records: DNSRecord[] }) {
  const t = useTranslations("portal.domains");
  const copy = (v: string) =>
    navigator.clipboard
      .writeText(v)
      .then(() => toast.success(t("copied")))
      .catch(() => toast.success(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-xs">
        <thead className="text-muted">
          <tr>
            <th className="py-1 pe-2 text-start font-medium">{t("type")}</th>
            <th className="py-1 pe-2 text-start font-medium">{t("name")}</th>
            <th className="py-1 pe-2 text-start font-medium">{t("value")}</th>
            <th className="py-1 text-start font-medium">{t("found")}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.type + r.name} className="border-border border-t align-top">
              <td className="py-1.5 pe-2 font-mono">{r.type}</td>
              <td className="py-1.5 pe-2">
                <button type="button" className="font-mono break-all hover:underline" onClick={() => copy(r.name)}>
                  <span dir="ltr">{r.name}</span>
                </button>
              </td>
              <td className="py-1.5 pe-2">
                <button
                  type="button"
                  className="inline-flex items-start gap-1 font-mono break-all hover:underline"
                  onClick={() => copy(r.value)}
                  aria-label={t("copyValue", { name: r.name })}
                >
                  <span dir="ltr">{r.value}</span>
                  <Copy className="mt-0.5 size-3 shrink-0" aria-hidden />
                </button>
              </td>
              <td className="py-1.5">
                {r.ok ? (
                  <CheckCircle2 className="text-success size-4" aria-label={t("yes")} />
                ) : (
                  <Circle className="text-muted size-4" aria-label={t("no")} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useDomainMutations(base: "/v1/domains" | "/v1/sender-domains", key: readonly string[]) {
  const t = useTranslations("portal.domains");
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const verify = useMutation({
    mutationFn: (id: string): Promise<{ status: Status }> =>
      base === "/v1/domains"
        ? unwrap(api.POST("/v1/domains/{domainId}/verify", { params: { path: { domainId: id } } }))
        : unwrap(api.POST("/v1/sender-domains/{domainId}/verify", { params: { path: { domainId: id } } })),
    meta: { silent: true },
    onSuccess: (d) => {
      void refresh();
      if (d.status === "verified") toast.success(t("verified"));
      else toast.error(t("notYet"));
    },
    onError: () => toast.error(t("failed")),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      base === "/v1/domains"
        ? unwrap(api.DELETE("/v1/domains/{domainId}", { params: { path: { domainId: id } } }))
        : unwrap(api.DELETE("/v1/sender-domains/{domainId}", { params: { path: { domainId: id } } })),
    onSuccess: () => void refresh(),
  });
  return { verify, remove };
}

function errorMessage(e: unknown, t: ReturnType<typeof useTranslations>) {
  if (isApiError(e)) {
    if (e.code === "domain_taken" || e.code === "domain_limit") return t(`errors.${e.code}`);
    if (Object.keys(e.fieldErrors).length) return t("errors.domain_invalid");
  }
  return t("failed");
}

/** Settings › Branding: the portal on the agency's own domain (portal.youragency.com, automatic HTTPS). */
export function CustomDomains() {
  const t = useTranslations("portal.domains");
  const qc = useQueryClient();
  const canEdit = useCan("agency.update");
  const q = useQuery({ queryKey: domainsKey, queryFn: () => unwrap(api.GET("/v1/domains")) });
  const [host, setHost] = useState("");
  const [err, setErr] = useState<string>();
  const add = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/domains", { body: { hostname: host } })),
    meta: { silent: true },
    onSuccess: () => {
      track("custom_domain.added");
      setHost("");
      setErr(undefined);
      void qc.invalidateQueries({ queryKey: domainsKey });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });
  const { verify, remove } = useDomainMutations("/v1/domains", domainsKey);
  const rows = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="text-accent size-5" aria-hidden />
          {t("customTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("customHint")}</p>
        {canEdit && rows.length < 3 && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (host.trim()) add.mutate();
            }}
          >
            <Field label={t("hostname")} error={err} className="min-w-60 flex-1">
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="portal.youragency.com"
                maxLength={260}
                dir="ltr"
              />
            </Field>
            <Button type="submit" loading={add.isPending}>
              {t("connect")}
            </Button>
          </form>
        )}
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("noDomains")}</p>
        ) : (
          <ul className="grid gap-3" data-testid="custom-domains">
            {rows.map((d) => (
              <li key={d.id} className="border-border grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="font-medium break-all">
                    {d.hostname}
                  </span>
                  <StatusBadge status={d.status} />
                  {d.status === "verified" && (
                    <a
                      href={`https://${d.hostname}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent text-xs underline"
                    >
                      {t("open")}
                    </a>
                  )}
                  {canEdit && (
                    <span className="ms-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={verify.isPending && verify.variables === d.id}
                        onClick={() => verify.mutate(d.id)}
                      >
                        <RefreshCw aria-hidden />
                        {t("verify")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("remove", { name: d.hostname })}
                        onClick={() => {
                          if (window.confirm(t("removeConfirm", { name: d.hostname }))) remove.mutate(d.id);
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  )}
                </div>
                {d.error && <p className="text-danger text-xs">{t(`reason.${d.error}`)}</p>}
                {d.status !== "verified" && <p className="text-muted text-xs">{t("addRecords")}</p>}
                <Records records={d.records} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Settings › Branding: client email from the agency's own domain (SPF, DKIM and DMARC). */
export function SenderDomains() {
  const t = useTranslations("portal.domains");
  const qc = useQueryClient();
  const canEdit = useCan("agency.update");
  const q = useQuery({ queryKey: sendersKey, queryFn: () => unwrap(api.GET("/v1/sender-domains")) });
  const [v, setV] = useState({ domain: "", from_local: "hello" });
  const [err, setErr] = useState<string>();
  const add = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/sender-domains", { body: v })),
    meta: { silent: true },
    onSuccess: () => {
      track("sender_domain.added");
      setV({ domain: "", from_local: "hello" });
      setErr(undefined);
      void qc.invalidateQueries({ queryKey: sendersKey });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });
  const { verify, remove } = useDomainMutations("/v1/sender-domains", sendersKey);
  const rows = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="text-accent size-5" aria-hidden />
          {t("senderTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("senderHint")}</p>
        {canEdit && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (v.domain.trim()) add.mutate();
            }}
          >
            <Field label={t("fromLocal")} className="w-32">
              <Input
                value={v.from_local}
                maxLength={64}
                dir="ltr"
                onChange={(e) => setV((x) => ({ ...x, from_local: e.target.value }))}
              />
            </Field>
            <Field label={t("emailDomain")} error={err} className="min-w-52 flex-1">
              <Input
                value={v.domain}
                placeholder="youragency.com"
                maxLength={260}
                dir="ltr"
                onChange={(e) => setV((x) => ({ ...x, domain: e.target.value }))}
              />
            </Field>
            <Button type="submit" loading={add.isPending}>
              {t("addSender")}
            </Button>
          </form>
        )}
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">{t("noSenders")}</p>
        ) : (
          <ul className="grid gap-3" data-testid="sender-domains">
            {rows.map((d) => (
              <li key={d.id} className="border-border grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="font-medium break-all">
                    {d.from_address}
                  </span>
                  <StatusBadge status={d.status} />
                  {canEdit && (
                    <span className="ms-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={verify.isPending && verify.variables === d.id}
                        onClick={() => verify.mutate(d.id)}
                      >
                        <RefreshCw aria-hidden />
                        {t("verify")}
                      </Button>
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
                  )}
                </div>
                <p className="text-muted text-xs">{d.status === "verified" ? t("senderLive") : t("senderRecords")}</p>
                <Records records={d.records} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
