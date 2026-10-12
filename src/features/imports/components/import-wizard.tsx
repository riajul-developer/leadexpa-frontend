"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, API_URL, CSRF_COOKIE, readCookie, unwrap, type Schemas } from "@/shared/lib/api/client";
import { toApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { importKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { NativeSelect } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { IMPORT_FIELDS, autoMap, hasContactColumn } from "../lib/mapping";

type Import = Schemas["Import"];

const STEPS = ["upload", "map", "review", "import", "done"] as const;

function stepFor(i: Import | undefined): (typeof STEPS)[number] {
  if (!i) return "upload";
  switch (i.status) {
    case "uploaded":
      return "map";
    case "validating":
    case "validated":
      return "review";
    case "importing":
      return "import";
    default:
      return "done";
  }
}

export function ImportWizard({ importId }: { importId?: string }) {
  const t = useTranslations("imports");
  const imp = useQuery({
    queryKey: importKeys.detail(importId ?? ""),
    queryFn: () => unwrap(api.GET("/v1/imports/{importId}", { params: { path: { importId: importId! } } })),
    enabled: !!importId,
    // SSE (import.progress) patches this cache; polling is the fallback while work is running.
    refetchInterval: (q) => (q.state.data && ["validating", "importing"].includes(q.state.data.status) ? 2000 : false),
  });
  const step = stepFor(imp.data);
  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("steps")}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1",
              s === step
                ? "bg-primary-soft text-primary font-medium"
                : STEPS.indexOf(step) > i
                  ? "text-success"
                  : "text-muted",
            )}
          >
            <span className="tabular-nums">{i + 1}.</span>
            {t(`step.${s}`)}
          </li>
        ))}
      </ol>
      {importId && imp.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : step === "upload" ? (
        <UploadStep />
      ) : step === "map" ? (
        <MapStep imp={imp.data!} />
      ) : step === "review" ? (
        <ReviewStep imp={imp.data!} />
      ) : (
        <ProgressStep imp={imp.data!} />
      )}
    </div>
  );
}

function UploadStep() {
  const t = useTranslations("imports.upload");
  const router = useRouter();
  const active = useActiveClient();
  const { clients } = useClients();
  const [clientId, setClientId] = useState(active ?? "");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const te = useTranslations("errors");

  // XHR for upload progress (fetch can't report it).
  const upload = (file: File) => {
    if (!clientId) return;
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/v1/clients/${clientId}/imports`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-CSRF-Token", readCookie(CSRF_COOKIE) ?? "");
    xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID());
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress((e.loaded / e.total) * 100);
    xhr.onload = () => {
      setProgress(null);
      const json = (() => {
        try {
          return JSON.parse(xhr.responseText) as Import & { code?: string };
        } catch {
          return null;
        }
      })();
      if (xhr.status === 201 && json) {
        track("import.uploaded", { rows_hint: json.total_rows });
        router.push(`/imports/${json.id}`);
      } else {
        const err = toApiError(new Response(null, { status: xhr.status }), json);
        setError(te.has(err.code) ? te(err.code) : (err.detail ?? te("internal")));
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError(te("network"));
    };
    xhr.send(body);
  };

  return (
    <Card>
      <CardContent className="grid gap-4 pt-4">
        <Field label={t("client")}>
          <NativeSelect value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t("pickClient")}</option>
            {clients
              .filter((c) => c.status === "active")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
          className={cn(
            "rounded-card flex flex-col items-center gap-3 border-2 border-dashed p-10 text-center",
            drag ? "border-primary bg-primary-soft" : "border-border",
            !clientId && "opacity-50",
          )}
        >
          <UploadCloud className="text-muted size-10" aria-hidden />
          <p className="font-medium">{t("drop")}</p>
          <p className="text-muted text-sm">{t("hint")}</p>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={!clientId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
            aria-label={t("choose")}
          />
          <Button variant="secondary" disabled={!clientId || progress !== null} onClick={() => input.current?.click()}>
            <FileUp aria-hidden />
            {t("choose")}
          </Button>
          {progress !== null && <Progress value={progress} label={t("uploading")} className="max-w-xs" />}
        </div>
        {error && (
          <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MapStep({ imp }: { imp: Import }) {
  const t = useTranslations("imports.map");
  const tf = useTranslations("imports.field");
  const qc = useQueryClient();
  const [mapping, setMapping] = useState<Record<string, string>>(() => autoMap(imp.headers, imp.mapping));
  const validate = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/imports/{importId}/validate", { params: { path: { importId: imp.id } }, body: { mapping } }),
      ),
    onSuccess: (r) => qc.setQueryData(importKeys.detail(imp.id), r),
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title", { file: imp.filename })}</CardTitle>
          <p className="text-muted text-sm">{t("hint", { rows: imp.total_rows })}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {imp.duplicate_file && (
          <p role="note" className="bg-warning-soft text-warning flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="size-4" aria-hidden />
            {t("duplicateFile")}
          </p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-start">
              <th scope="col" className="py-2 font-medium">
                {t("column")}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t("field")}
              </th>
            </tr>
          </thead>
          <tbody>
            {imp.headers.map((h) => (
              <tr key={h} className="border-border border-t">
                <th scope="row" className="py-2 text-start font-medium">
                  {h}
                </th>
                <td className="py-2">
                  <NativeSelect
                    value={mapping[h] ?? "custom"}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                    aria-label={t("fieldFor", { column: h })}
                  >
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {tf(f)}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!hasContactColumn(mapping) && (
          <p role="alert" className="text-danger text-sm">
            {t("needContact")}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={() => validate.mutate()} disabled={!hasContactColumn(mapping)} loading={validate.isPending}>
            {t("dryRun")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({ imp }: { imp: Import }) {
  const t = useTranslations("imports.review");
  const f = useFormat();
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/imports/{importId}/confirm", { params: { path: { importId: imp.id } } })),
    onSuccess: (r) => {
      track("import.confirmed", { valid: imp.valid_rows, duplicates: imp.duplicate_count, errors: imp.error_count });
      qc.setQueryData(importKeys.detail(imp.id), r);
    },
  });
  if (imp.status === "validating") {
    return (
      <Card>
        <CardContent className="grid gap-3 pt-4">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("checking")}
          </p>
          <Progress value={imp.total_rows ? (imp.processed_rows / imp.total_rows) * 100 : 0} label={t("checking")} />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-success-soft rounded-lg p-3">
            <p className="text-success text-2xl font-semibold tabular-nums">{f.number(imp.valid_rows)}</p>
            <p className="text-sm">{t("valid")}</p>
          </div>
          <div className="bg-warning-soft rounded-lg p-3">
            <p className="text-warning text-2xl font-semibold tabular-nums">{f.number(imp.duplicate_count)}</p>
            <p className="text-sm">{t("duplicates")}</p>
          </div>
          <div className="bg-danger-soft rounded-lg p-3">
            <p className="text-danger text-2xl font-semibold tabular-nums">{f.number(imp.error_count)}</p>
            <p className="text-sm">{t("errors")}</p>
          </div>
        </div>
        <RowsTable title={t("preview")} rows={imp.preview} />
        {imp.errors_sample.length > 0 && <RowsTable title={t("errorSample")} rows={imp.errors_sample} />}
        {imp.has_error_report && <ErrorReportLink importId={imp.id} />}
        <p className="text-muted text-sm">{t("noSla")}</p>
        <div className="flex justify-end">
          <Button onClick={() => confirm.mutate()} disabled={imp.valid_rows === 0} loading={confirm.isPending}>
            {t("confirm", { count: imp.valid_rows })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RowsTable({ title, rows }: { title: string; rows: Schemas["ImportRow"][] }) {
  const t = useTranslations("imports.review");
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-muted text-start">
            <th scope="col" className="py-1.5 font-medium">
              {t("row")}
            </th>
            <th scope="col" className="py-1.5 font-medium">
              {t("name")}
            </th>
            <th scope="col" className="py-1.5 font-medium">
              {t("phone")}
            </th>
            <th scope="col" className="py-1.5 font-medium">
              {t("status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row} className="border-border border-t">
              <td className="py-1.5 tabular-nums">{r.row}</td>
              <td className="py-1.5">{r.full_name || "—"}</td>
              <td className="py-1.5 tabular-nums">{r.phone || r.email || "—"}</td>
              <td className="py-1.5">
                <Badge tone={r.status === "new" ? "success" : r.status === "duplicate" ? "warning" : "danger"}>
                  {t(`rowStatus.${r.status}`)}
                </Badge>
                {r.reasons?.map((x) => (
                  <span key={x} className="text-muted ms-1 text-xs">
                    {t(`reason.${x}`)}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorReportLink({ importId }: { importId: string }) {
  const t = useTranslations("imports");
  return (
    <Button asChild variant="secondary" className="justify-self-start">
      <a href={`${API_URL}/v1/imports/${importId}/error-report`} download>
        <Download aria-hidden />
        {t("errorReport")}
      </a>
    </Button>
  );
}

function ProgressStep({ imp }: { imp: Import }) {
  const t = useTranslations("imports.progress");
  const f = useFormat();
  const done = imp.status === "completed";
  const failed = imp.status === "failed";
  const pct = imp.total_rows ? (imp.processed_rows / imp.total_rows) * 100 : 0;
  useEffect(() => {
    if (done)
      track("import.completed", {
        created: imp.created_count,
        duplicates: imp.duplicate_count,
        errors: imp.error_count,
      });
  }, [done, imp.created_count, imp.duplicate_count, imp.error_count]);
  if (failed)
    return <EmptyState icon={AlertTriangle} title={t("failed")} description={imp.failure_reason ?? undefined} />;
  return (
    <Card>
      <CardContent className="grid gap-4 pt-4">
        {done ? (
          <p className="text-success flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-5" aria-hidden />
            {t("done")}
          </p>
        ) : (
          <>
            <p className="text-sm" aria-live="polite">
              {t("running", { done: f.number(imp.processed_rows), total: f.number(imp.total_rows) })}
            </p>
            <Progress value={pct} label={t("progress")} />
          </>
        )}
        <dl className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <dt className="text-muted">{t("created")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{f.number(imp.created_count)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("duplicates")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{f.number(imp.duplicate_count)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("errors")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{f.number(imp.error_count)}</dd>
          </div>
        </dl>
        {done && imp.has_error_report && <ErrorReportLink importId={imp.id} />}
      </CardContent>
    </Card>
  );
}
