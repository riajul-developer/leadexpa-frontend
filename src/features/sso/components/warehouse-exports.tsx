"use client";

import { Database, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import {
  type WarehouseExport,
  type WarehouseExportInput,
  useWarehouseExportActions,
  useWarehouseExports,
} from "../api";

import { CopyValue } from "./copy-value";
import {
  type CloudErrors,
  type CloudValues,
  CloudStorageFields,
  ReplaceKey,
  cloudBody,
  isCloudKind,
  useCloudErrors,
} from "./storage-fields";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Settings › Single sign-on › Data warehouse export (G7h): daily Parquet snapshots in the agency's own bucket. */
export function WarehouseExportsCard() {
  const t = useTranslations("sso.warehouse");
  const { data: me } = useMe();
  const owner = me?.membership?.role === "owner";
  const q = useWarehouseExports();
  const [adding, setAdding] = useState(false);
  if (q.isPending || !q.data) return <Skeleton className="h-48 w-full" />;
  const { data: exports, available, aws_principal: principal, tables, kinds } = q.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        <p className="text-muted text-xs">{t("tables", { tables: tables.join(", ") })}</p>
        {!available && <p className="bg-surface-2 rounded-lg px-3 py-2 text-sm">{t("unavailable")}</p>}
        {exports.length === 0 ? (
          available && <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="divide-border grid divide-y" data-testid="warehouse-exports">
            {exports.map((e) => (
              <ExportRow key={e.id} ex={e} owner={owner} />
            ))}
          </ul>
        )}
        {owner &&
          available &&
          (adding ? (
            <AddExport principal={principal} kinds={kinds} onDone={() => setAdding(false)} />
          ) : (
            <div>
              <Button variant="secondary" onClick={() => setAdding(true)} disabled={exports.length >= 3}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            </div>
          ))}
        {!owner && <p className="text-muted text-xs">{t("ownersOnly")}</p>}
      </CardContent>
    </Card>
  );
}

function ExportRow({ ex, owner }: { ex: WarehouseExport; owner: boolean }) {
  const t = useTranslations("sso.warehouse");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { update, run, remove } = useWarehouseExportActions();
  const contactId = useId();
  const paused = ex.status === "paused";
  const last = ex.last_run;
  const running = ex.running || last?.status === "running";
  return (
    <li className="grid gap-1.5 py-3" data-testid="warehouse-export">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{ex.name}</span>
        {paused ? (
          <Badge tone="neutral">{t("paused")}</Badge>
        ) : running ? (
          <Badge tone="info">{t("running")}</Badge>
        ) : last?.status === "failed" ? (
          <Badge tone="danger">{t("failed")}</Badge>
        ) : last?.status === "succeeded" ? (
          <Badge tone="success">{t("succeeded")}</Badge>
        ) : (
          <Badge tone="neutral">{t("waiting")}</Badge>
        )}
      </div>
      <CopyValue label={t("location")} value={ex.location} />
      <p className="text-muted text-xs">
        {t("schedule", { hour: hh(ex.hour_utc) })}
        {!paused && <> · {t("next", { when: fmt.dateTime(ex.next_run_at, tz) })}</>}
      </p>
      {last && last.status === "succeeded" && (
        <p className="text-muted text-xs" data-testid="last-run">
          {t("lastRun", {
            when: fmt.dateTime(last.finished_at ?? last.started_at, tz),
            rows: last.rows,
            mb: fmt.number(last.bytes / 1_048_576, { maximumFractionDigits: 1 }),
            snapshot: last.snapshot,
          })}
        </p>
      )}
      {last?.status === "failed" && last.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {t("lastError", { error: last.error })}
        </p>
      )}
      <div className="flex items-start justify-between gap-4">
        <span className="grid gap-0.5">
          <label htmlFor={contactId} className="text-sm">
            {t("includeContact")}
          </label>
          <span className="text-muted text-xs">{t("includeContactHint")}</span>
        </span>
        <Switch
          id={contactId}
          checked={ex.include_contact}
          disabled={!owner || update.isPending}
          onCheckedChange={(v) => {
            if (v && !window.confirm(t("includeContactConfirm"))) return;
            update.mutate(
              { id: ex.id, include_contact: v },
              {
                onSuccess: () => {
                  track("security.warehouse_export.contact", { include: v });
                  toast.success(v ? t("contactOn") : t("contactOff"));
                },
                onError: () => toast.error(t("errors.failed")),
              },
            );
          }}
        />
      </div>
      {owner && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={paused || running}
            loading={run.isPending}
            onClick={() =>
              run.mutate(ex.id, {
                onSuccess: () => {
                  track("security.warehouse_export.run");
                  toast.success(t("queued"));
                },
              })
            }
          >
            <RefreshCw aria-hidden />
            {t("runNow")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: ex.id, status: paused ? "active" : "paused" },
                {
                  onSuccess: () => toast.success(paused ? t("resumed") : t("pausedToast")),
                  onError: (e) =>
                    toast.error(isApiError(e) && e.code === "plan_limit" ? t("errors.plan") : t("errors.failed")),
                },
              )
            }
          >
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {paused ? t("resume") : t("pause")}
          </Button>
          {isCloudKind(ex.kind) && (
            <ReplaceKey
              kind={ex.kind}
              pending={update.isPending}
              onSave={(body, done) => update.mutate({ id: ex.id, ...body }, { onSuccess: () => done(), onError: done })}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto"
            aria-label={t("delete", { name: ex.name })}
            onClick={() => {
              if (!window.confirm(t("deleteConfirm", { name: ex.name }))) return;
              remove.mutate(ex.id, {
                onSuccess: () => {
                  track("security.warehouse_export.deleted");
                  toast.success(t("deleted"));
                },
              });
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

const FIELDS = ["name", "bucket", "region", "prefix", "hour_utc"] as const;

function AddExport({
  principal,
  kinds,
  onDone,
}: {
  principal: string;
  kinds: NonNullable<WarehouseExport["kind"]>[];
  onDone: () => void;
}) {
  const t = useTranslations("sso.warehouse");
  const ts = useTranslations("sso.storage");
  const [kind, setKind] = useState<WarehouseExport["kind"]>(kinds[0] ?? "s3");
  const [cloud, setCloud] = useState<CloudValues>({});
  const [cloudErrors, setCloudErrors] = useState<CloudErrors>({});
  const toCloudErrors = useCloudErrors();
  const { create } = useWarehouseExportActions();
  const contactId = useId();
  const [v, setV] = useState<WarehouseExportInput>({
    name: "",
    bucket: "",
    region: "",
    prefix: "",
    hour_utc: 2,
    include_contact: false,
  });
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({});
  const set = (patch: Partial<WarehouseExportInput>) => setV((cur) => ({ ...cur, ...patch }));
  return (
    <form
      className="border-border grid gap-3 rounded-lg border p-3"
      noValidate
      data-testid="add-warehouse-export"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        setFieldErrors({});
        setCloudErrors({});
        const body: WarehouseExportInput = isCloudKind(kind)
          ? {
              name: v.name.trim(),
              kind,
              hour_utc: v.hour_utc,
              include_contact: v.include_contact,
              ...cloudBody(kind, cloud),
            }
          : {
              ...v,
              kind,
              name: v.name.trim(),
              bucket: v.bucket?.trim(),
              region: v.region?.trim(),
              prefix: v.prefix?.trim(),
            };
        create.mutate(body, {
          onSuccess: () => {
            track("security.warehouse_export.created", { include_contact: body.include_contact });
            toast.success(t("created"));
            onDone();
          },
          onError: (e) => {
            if (!isApiError(e)) return setError(t("errors.failed"));
            if (e.code === "plan_limit") return setError(t("errors.plan"));
            if (e.code === "warehouse_export_limit") return setError(t("errors.limit"));
            const ce = isCloudKind(kind) ? toCloudErrors(e) : null;
            if (ce) return setCloudErrors(ce);
            const fe: typeof fieldErrors = {};
            for (const f of FIELDS) if (e.fieldErrors[f]) fe[f] = t(`errors.${f}`);
            if (Object.keys(fe).length === 0) return setError(t("errors.failed"));
            setFieldErrors(fe);
          },
        });
      }}
    >
      {error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <Field label={t("name")} error={fieldErrors.name}>
        <Input value={v.name} maxLength={80} placeholder="Snowflake" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      {kinds.length > 1 && (
        <Field label={ts("destination")}>
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as WarehouseExport["kind"])}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {ts(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {isCloudKind(kind) ? (
        <CloudStorageFields
          kind={kind}
          value={cloud}
          onChange={(p) => setCloud((c) => ({ ...c, ...p }))}
          errors={cloudErrors}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("bucket")} error={fieldErrors.bucket}>
            <Input
              dir="ltr"
              value={v.bucket}
              placeholder="acme-lake"
              onChange={(e) => set({ bucket: e.target.value })}
            />
          </Field>
          <Field label={t("region")} error={fieldErrors.region}>
            <Input
              dir="ltr"
              value={v.region}
              placeholder="eu-west-1"
              onChange={(e) => set({ region: e.target.value })}
            />
          </Field>
          <Field label={t("prefix")} error={fieldErrors.prefix}>
            <Input dir="ltr" value={v.prefix} placeholder="raw/" onChange={(e) => set({ prefix: e.target.value })} />
          </Field>
        </div>
      )}
      <Field label={t("hour")} hint={t("hourHint")} error={fieldErrors.hour_utc}>
        <NativeSelect value={v.hour_utc} onChange={(e) => set({ hour_utc: Number(e.target.value) })}>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hh(h)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {kind === "s3" && <p className="text-muted text-xs">{t("s3Hint")}</p>}
      {kind === "s3" && principal && <CopyValue label={t("principal")} value={principal} />}
      <div className="flex items-start justify-between gap-4">
        <span className="grid gap-0.5">
          <label htmlFor={contactId} className="text-sm font-medium">
            {t("includeContact")}
          </label>
          <span className="text-muted text-xs">{t("includeContactHint")}</span>
        </span>
        <Switch id={contactId} checked={v.include_contact} onCheckedChange={(b) => set({ include_contact: b })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={create.isPending} disabled={!v.name.trim()}>
          {t("create")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
