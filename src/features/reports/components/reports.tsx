"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { Ban, Copy, Download, FileText, Link2, Plus, RefreshCw, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { toApiLocale, type AppLocale } from "@/shared/config/locales";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, API_URL, unwrap, type Schemas } from "@/shared/lib/api/client";
import { localDate } from "@/shared/lib/format";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { clientKeys, reportKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { LocaleSelect } from "@/shared/ui/locale-fields";
import { Checkbox, Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { ReportDocument } from "./report-document";

type Report = Schemas["Report"];

const PDF_TONE = { pending: "warning", ready: "success", failed: "danger" } as const;

export function ClientReports({ clientId }: { clientId: string }) {
  const t = useTranslations("reports");
  const f = useFormat();
  const now = useNow();
  const canShare = useCan("report.share");
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: clientKeys.reports(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/reports", { params: { path: { clientId } } })),
    // A new report renders its PDF in the background: poll while one is pending.
    refetchInterval: (query) => (query.state.data?.data.some((r) => r.pdf_status === "pending") ? 3000 : false),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        {canShare && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t("create")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !q.data?.data.length ? (
          <EmptyState icon={FileText} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <ul className="grid gap-2">
            {q.data.data.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="border-border hover:bg-surface-2 flex flex-wrap items-center gap-2 rounded-lg border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="text-muted text-xs">
                      {r.period_from} – {r.period_to} · v{r.version} · {f.relative(r.created_at, now || Date.now())}
                    </span>
                  </span>
                  <Badge tone={PDF_TONE[r.pdf_status]}>{t(`pdf.${r.pdf_status}`)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {creating && <CreateReportDialog clientId={clientId} onClose={() => setCreating(false)} />}
    </Card>
  );
}

function CreateReportDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const t = useTranslations("reports.form");
  const locale = useLocale() as AppLocale;
  const { byId } = useClients();
  const qc = useQueryClient();
  const router = useRouter();
  const fallbackTz = useDisplayTimeZone();
  const tz = byId.get(clientId)?.timezone ?? fallbackTz;
  const now = new Date();
  // Default: last full calendar month in the client's timezone.
  const firstThisMonth = `${localDate(now, tz).slice(0, 7)}-01`;
  const lastMonthEnd = localDate(subDays(new Date(firstThisMonth + "T12:00:00Z"), 1), "UTC");
  const [from, setFrom] = useState(`${lastMonthEnd.slice(0, 7)}-01`);
  const [to, setTo] = useState(lastMonthEnd);
  const [lang, setLang] = useState<AppLocale>(locale);
  const [title, setTitle] = useState("");
  const [includeLeads, setIncludeLeads] = useState(false);
  const [narrative, setNarrative] = useState("");
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/reports", {
          params: { path: { clientId } },
          body: {
            from,
            to,
            locale: toApiLocale(lang),
            title: title.trim() || undefined,
            include_leads: includeLeads,
            narrative: narrative.trim() || undefined,
          },
        }),
      ),
    onSuccess: (r) => {
      track("report.created", { include_leads: includeLeads, locale: lang });
      void qc.invalidateQueries({ queryKey: clientKeys.reports(clientId) });
      qc.setQueryData(reportKeys.detail(r.id), r);
      onClose();
      router.push(`/reports/${r.id}`);
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("title")} description={t("immutable")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("from")}>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} required />
            </Field>
            <Field label={t("to")}>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
            </Field>
          </div>
          <Field label={t("language")} hint={t("languageHint")}>
            <LocaleSelect value={lang} onValueChange={setLang} />
          </Field>
          <Field label={t("reportTitle")} hint={t("titleHint")}>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t("narrative")} hint={t("narrativeHint")}>
            <Textarea rows={4} maxLength={10000} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={includeLeads} onCheckedChange={(v) => setIncludeLeads(v === true)} className="mt-0.5" />
            <span>
              {t("includeLeads")}
              <span className="text-muted block text-xs">{t("includeLeadsHint")}</span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** /reports: reports are per client — pick one (or use the global client filter). */
export function ReportsPage() {
  const t = useTranslations("reports");
  const active = useActiveClient();
  const { clients } = useClients();
  const [picked, setPicked] = useState<string>("");
  const clientId = active ?? picked ?? "";
  const list = clients.filter((c) => c.status === "active");
  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {!active && (
        <Field label={t("client")}>
          <NativeSelect value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">{t("pickClient")}</option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {clientId ? <ClientReports clientId={clientId} /> : <EmptyState icon={FileText} title={t("pickClientHint")} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export function ReportDetail({ reportId }: { reportId: string }) {
  const t = useTranslations("reports");
  const qc = useQueryClient();
  const canShare = useCan("report.share");
  const q = useQuery({
    queryKey: reportKeys.detail(reportId),
    queryFn: () => unwrap(api.GET("/v1/reports/{reportId}", { params: { path: { reportId } } })),
    refetchInterval: (query) => (query.state.data?.pdf_status === "pending" ? 3000 : false),
  });
  const regenerate = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/reports/{reportId}/pdf", { params: { path: { reportId } } })),
    onSuccess: (r) =>
      qc.setQueryData<Report>(reportKeys.detail(reportId), (old) =>
        old ? { ...old, ...r, snapshot: old.snapshot } : old,
      ),
  });
  if (q.isPending)
    return (
      <div className="p-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!q.data?.snapshot) return <EmptyState icon={FileText} title={t("notFound")} />;
  const r = q.data;
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-[1fr_20rem]">
      <Card className="p-5 sm:p-8">
        <ReportDocument snapshot={r.snapshot!} title={r.title} locale={r.locale} />
      </Card>
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("pdfTitle")}</CardTitle>
            <Badge tone={PDF_TONE[r.pdf_status]}>{t(`pdf.${r.pdf_status}`)}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2">
            {r.pdf_status === "ready" && (
              <Button asChild>
                <a href={`${API_URL}/v1/reports/${r.id}/pdf`} download onClick={() => track("report.pdf.downloaded")}>
                  <Download aria-hidden />
                  {t("downloadPdf")}
                </a>
              </Button>
            )}
            {r.pdf_status === "failed" && (
              <p className="text-danger text-sm">
                {r.pdf_error === "pdf_renderer_unconfigured" ? t("pdfUnconfigured") : t("pdfFailed")}
              </p>
            )}
            {canShare && r.pdf_status !== "pending" && (
              <Button variant="secondary" onClick={() => regenerate.mutate()} loading={regenerate.isPending}>
                <RefreshCw aria-hidden />
                {t("regenerate")}
              </Button>
            )}
          </CardContent>
        </Card>
        {canShare && <SharesCard reportId={r.id} />}
      </div>
    </div>
  );
}

function SharesCard({ reportId }: { reportId: string }) {
  const t = useTranslations("reports.share");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const [expiry, setExpiry] = useState("30");
  const [created, setCreated] = useState<string | null>(null);
  const shares = useQuery({
    queryKey: reportKeys.shares(reportId),
    queryFn: () => unwrap(api.GET("/v1/reports/{reportId}/shares", { params: { path: { reportId } } })),
  });
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/reports/{reportId}/shares", {
          params: { path: { reportId } },
          body: {
            expires_at: expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86400_000).toISOString(),
          },
        }),
      ),
    onSuccess: (s) => {
      track("report.shared", { expiry_days: expiry });
      setCreated(s.url);
      void navigator.clipboard
        ?.writeText(s.url)
        .then(() => toast.success(t("copied")))
        .catch(() => undefined);
      void qc.invalidateQueries({ queryKey: reportKeys.shares(reportId) });
    },
  });
  const revoke = useMutation({
    mutationFn: (shareId: string) =>
      unwrap(api.DELETE("/v1/reports/{reportId}/shares/{shareId}", { params: { path: { reportId, shareId } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.shares(reportId) }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex gap-2">
          <NativeSelect value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label={t("expiry")}>
            <option value="7">{t("days", { n: 7 })}</option>
            <option value="30">{t("days", { n: 30 })}</option>
            <option value="90">{t("days", { n: 90 })}</option>
            <option value="never">{t("never")}</option>
          </NativeSelect>
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            <Share2 aria-hidden />
            {t("create")}
          </Button>
        </div>
        {created && (
          <div className="bg-success-soft grid gap-2 rounded-lg p-3">
            <p className="text-success text-xs">{t("onlyOnce")}</p>
            <div className="flex gap-2">
              <Input readOnly value={created} onFocus={(e) => e.currentTarget.select()} aria-label={t("link")} />
              <Button
                size="icon"
                variant="secondary"
                aria-label={t("copy")}
                onClick={() => void navigator.clipboard.writeText(created).then(() => toast.success(t("copied")))}
              >
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
        )}
        <ul className="grid gap-2 text-sm">
          {shares.data?.data.map((s) => (
            <li key={s.id} className="border-border flex items-center gap-2 rounded-lg border p-2">
              <Link2 className="text-muted size-4" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block">{t("views", { count: s.view_count })}</span>
                <span className="text-muted text-xs">
                  {!s.active
                    ? s.revoked_at
                      ? t("revoked")
                      : t("expired")
                    : s.expires_at
                      ? t("expires", { when: f.relative(s.expires_at, now || Date.now()) })
                      : t("noExpiry")}
                </span>
              </span>
              {s.active && (
                <Button size="icon-sm" variant="ghost" aria-label={t("revoke")} onClick={() => revoke.mutate(s.id)}>
                  <Ban aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
