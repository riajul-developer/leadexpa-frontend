"use client";

import { FileSearch, FileUp, Link2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone, usePreferences } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Checkbox, Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type AuditImport,
  type LeakageAudit,
  useAudit,
  useAudits,
  useConvertAudit,
  useCreateAudit,
  useDeleteAudit,
  useSetAssumptions,
  useShareAudit,
  useUploadAuditLog,
} from "./audit-api";
import { AuditReportView } from "./audit-report";

const INDUSTRIES = ["clinic", "real_estate", "education", "automotive", "ecommerce", "other"] as const;

function StatusBadge({ a }: { a: LeakageAudit }) {
  const t = useTranslations("revintel.audit");
  const tone = a.status === "collecting" ? "info" : a.status === "converted" ? "success" : "neutral";
  return <Badge tone={tone}>{t(`status.${a.status}`)}</Badge>;
}

/** /audits: Lead Leakage Audits of prospects (10.3), the agency's sales tool. */
export function AuditsPage() {
  const t = useTranslations("revintel.audit");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const q = useAudits();
  const [open, setOpen] = useState(false);
  const rows = q.data?.data ?? [];
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileSearch className="text-accent size-6" aria-hidden />
            {t("title")}
          </h1>
          <p className="text-muted text-sm">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </header>
      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileSearch} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="grid gap-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/audits/${a.id}`}
                className="border-border bg-surface hover:bg-surface-2 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
              >
                <span className="font-semibold">{a.prospect_name}</span>
                <StatusBadge a={a} />
                <span className="text-muted">{t("leadCount", { count: a.leads })}</span>
                <span className="text-muted ms-auto text-xs">
                  {a.status === "collecting"
                    ? t("endsOn", { when: f.dateTime(a.expires_at, tz, "date") })
                    : f.dateTime(a.created_at, tz, "date")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open && <NewAuditDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewAuditDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("revintel.audit");
  const tc = useTranslations("clients");
  const te = useTranslations("errors");
  const router = useRouter();
  const create = useCreateAudit();
  // The agency's own country to start with; most prospects are local.
  const region = usePreferences((s) => s.region) ?? "";
  const [v, setV] = useState({
    prospect_name: "",
    industry: "clinic",
    country: region,
    consent_name: "",
    consent_email: "",
  });
  const [agreed, setAgreed] = useState(false);
  const consentText = t("consentText", { prospect: v.prospect_name || "…" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { ...v, country: v.country.toUpperCase(), consent_text: consentText },
      {
        onSuccess: (a) => {
          toast.success(t("created"));
          router.push(`/audits/${a.id}`);
        },
        onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : t("failed")),
      },
    );
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("newTitle")} description={t("newHint")}>
        <form onSubmit={submit} className="grid gap-3">
          <Field label={t("prospect")}>
            <Input required maxLength={200} value={v.prospect_name} onChange={set("prospect_name")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("industry")}>
              <NativeSelect value={v.industry} onChange={set("industry")}>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {tc.has(`industry.${i}`) ? tc(`industry.${i}`) : i}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("country")} hint={t("countryHint")}>
              <Input required minLength={2} maxLength={2} value={v.country} onChange={set("country")} />
            </Field>
            <Field label={t("consentName")}>
              <Input required maxLength={200} value={v.consent_name} onChange={set("consent_name")} />
            </Field>
            <Field label={t("consentEmail")}>
              <Input required type="email" maxLength={254} value={v.consent_email} onChange={set("consent_email")} />
            </Field>
          </div>
          <p className="bg-surface-2 rounded-lg p-3 text-sm">{consentText}</p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={agreed}
              onCheckedChange={(c) => setAgreed(c === true)}
              aria-label={t("consentConfirm")}
            />
            <span>{t("consentConfirm")}</span>
          </label>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!agreed} loading={create.isPending}>
              {t("start")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** /audits/[id]: load the prospect's lead log, set the assumptions, read and share the report. */
export function AuditDetail({ id }: { id: string }) {
  const t = useTranslations("revintel.audit");
  const te = useTranslations("errors");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const router = useRouter();
  const q = useAudit(id);
  const upload = useUploadAuditLog(id);
  const share = useShareAudit(id);
  const del = useDeleteAudit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<AuditImport | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const a = q.data;
  if (q.isPending) return <Skeleton className="m-4 h-96" />;
  if (!a) return <EmptyState icon={FileSearch} title={t("notFound")} />;
  const fail = (e: unknown) =>
    toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : isApiError(e) ? e.message : t("failed"));
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{a.prospect_name}</h1>
          <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge a={a} />
            {t("consentBy", { name: a.consent_name, when: f.dateTime(a.consent_at, tz, "date") })}
            {a.status === "collecting" && ` · ${t("endsOn", { when: f.dateTime(a.expires_at, tz, "date") })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={share.isPending}
            onClick={() => share.mutate(undefined, { onSuccess: ({ url }) => setLink(url), onError: fail })}
          >
            <Link2 aria-hidden />
            {t("share")}
          </Button>
          <Button
            variant="ghost"
            loading={del.isPending}
            onClick={() => {
              if (!window.confirm(t("deleteConfirm"))) return;
              del.mutate(id, { onSuccess: () => router.push("/audits"), onError: fail });
            }}
          >
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        </div>
      </header>
      {link && (
        <p className="bg-surface-2 rounded-lg p-3 text-sm" role="status">
          {t("shareReady")}{" "}
          <span dir="ltr" className="font-mono text-xs break-all">
            {link}
          </span>
        </p>
      )}
      {a.status === "deleted" && <p className="text-muted text-sm">{t("logDeleted")}</p>}

      {a.status === "collecting" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("logTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-muted text-sm">{t("logHint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                id="audit-csv"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  upload.mutate(file, { onSuccess: setLast, onError: fail });
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button asChild variant="secondary" loading={upload.isPending}>
                <label htmlFor="audit-csv">
                  <FileUp aria-hidden />
                  {t("upload")}
                </label>
              </Button>
              <span className="text-muted text-xs">{t("leadCount", { count: a.leads })}</span>
            </div>
            {last && (
              <p className="text-sm" role="status" data-testid="audit-import">
                {t("imported", { added: last.added, duplicates: last.duplicates, rejected: last.rejected.length })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {a.status !== "deleted" && <AssumptionsCard audit={a} />}
      {a.report && <AuditReportView report={a.report} currency={a.currency} industry={a.industry} />}
      {a.status === "collecting" && <ConvertCard id={id} />}
    </div>
  );
}

function AssumptionsCard({ audit }: { audit: LeakageAudit }) {
  const t = useTranslations("revintel.audit.assumptions");
  const te = useTranslations("errors");
  const save = useSetAssumptions(audit.id);
  const major = (v: number | null) => (v == null ? "" : String(v / 100));
  const [v, setV] = useState({
    dealLow: major(audit.deal_value_low),
    dealHigh: major(audit.deal_value_high),
    closeLow: audit.close_rate_low == null ? "" : String(Math.round(audit.close_rate_low * 100)),
    closeHigh: audit.close_rate_high == null ? "" : String(Math.round(audit.close_rate_high * 100)),
    from: audit.business_hours.from,
    to: audit.business_hours.to,
  });
  useEffect(() => {
    setV((x) => ({ ...x, from: audit.business_hours.from, to: audit.business_hours.to }));
  }, [audit.business_hours.from, audit.business_hours.to]);
  const num = (s: string, scale: number) => (s.trim() === "" ? null : Math.round(Number(s) * scale));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                deal_value_low: num(v.dealLow, 100),
                deal_value_high: num(v.dealHigh, 100),
                close_rate_low: num(v.closeLow, 1) == null ? null : Number(v.closeLow) / 100,
                close_rate_high: num(v.closeHigh, 1) == null ? null : Number(v.closeHigh) / 100,
                business_hours: { from: v.from, to: v.to },
              },
              {
                onSuccess: () => toast.success(t("saved")),
                onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : t("failed")),
              },
            );
          }}
        >
          <p className="text-muted text-sm">{t("hint")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("dealLow", { currency: audit.currency })}>
              <Input type="number" min={0} step="any" value={v.dealLow} onChange={set("dealLow")} />
            </Field>
            <Field label={t("dealHigh", { currency: audit.currency })}>
              <Input type="number" min={0} step="any" value={v.dealHigh} onChange={set("dealHigh")} />
            </Field>
            <div />
            <Field label={t("closeLow")} hint={t("closeHint")}>
              <Input type="number" min={0} max={100} value={v.closeLow} onChange={set("closeLow")} />
            </Field>
            <Field label={t("closeHigh")}>
              <Input type="number" min={0} max={100} value={v.closeHigh} onChange={set("closeHigh")} />
            </Field>
            <div />
            <Field label={t("from")}>
              <Input type="time" value={v.from} onChange={set("from")} />
            </Field>
            <Field label={t("to")}>
              <Input type="time" value={v.to} onChange={set("to")} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ConvertCard({ id }: { id: string }) {
  const t = useTranslations("revintel.audit");
  const { clients } = useClients();
  const convert = useConvertAudit(id);
  const [client, setClient] = useState("");
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-2 pt-4">
        <Field label={t("convertLabel")} hint={t("convertHint")} className="min-w-56 flex-1">
          <NativeSelect value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">{t("pickClient")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button
          variant="secondary"
          disabled={!client}
          loading={convert.isPending}
          onClick={() => convert.mutate(client, { onSuccess: () => toast.success(t("converted")) })}
        >
          {t("convert")}
        </Button>
      </CardContent>
    </Card>
  );
}
