"use client";

import { Pause, Play, Plus, RefreshCw, Send, ShieldCheck, Trash2 } from "lucide-react";
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

import { type AuditStream, type AuditStreamInput, useAuditStreamActions, useAuditStreams } from "../api";

import { CopyValue, useCopy } from "./copy-value";
import {
  type CloudErrors,
  type CloudValues,
  CloudStorageFields,
  ReplaceKey,
  cloudBody,
  cloudLocation,
  isCloudKind,
  useCloudErrors,
} from "./storage-fields";

type Kind = AuditStream["kind"];
type Created = { name: string; secret: string };

/** Settings › Single sign-on › Audit log streaming (G7g): the audit log sent to the agency's SIEM or S3 bucket. */
export function AuditStreamsCard() {
  const t = useTranslations("sso.streams");
  const { data: me } = useMe();
  const owner = me?.membership?.role === "owner";
  const q = useAuditStreams();
  const copy = useCopy();
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  if (q.isPending || !q.data) return <Skeleton className="h-48 w-full" />;
  const { data: streams, kinds, aws_principal: principal } = q.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        {created && (
          <div className="border-primary bg-primary-soft grid gap-2 rounded-lg border p-3" data-testid="stream-secret">
            <p className="text-sm font-medium">{t("secretOnce", { name: created.name })}</p>
            <CopyValue label={t("secret")} value={created.secret} />
            <p className="text-muted text-xs">{t("secretHint")}</p>
            <div>
              <Button size="sm" variant="secondary" onClick={() => (copy(created.secret), setCreated(null))}>
                {t("copiedDone")}
              </Button>
            </div>
          </div>
        )}
        {streams.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="divide-border grid divide-y" data-testid="audit-streams">
            {streams.map((s) => (
              <StreamRow key={s.id} stream={s} owner={owner} onSecret={setCreated} />
            ))}
          </ul>
        )}
        {owner &&
          (adding ? (
            <AddStream
              kinds={kinds}
              principal={principal}
              onCancel={() => setAdding(false)}
              onCreated={(name, secret) => {
                setAdding(false);
                if (secret) setCreated({ name, secret });
              }}
            />
          ) : (
            <div>
              <Button variant="secondary" onClick={() => setAdding(true)} disabled={streams.length >= 5}>
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

function destination(s: AuditStream) {
  return s.kind === "https" ? s.url : cloudLocation(s.kind, s);
}

function StreamRow({
  stream: s,
  owner,
  onSecret,
}: {
  stream: AuditStream;
  owner: boolean;
  onSecret: (c: Created) => void;
}) {
  const t = useTranslations("sso.streams");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { setStatus, remove, rotate, test, replaceKey } = useAuditStreamActions();
  const paused = s.status === "paused";
  return (
    <li className="grid gap-1.5 py-3" data-testid="audit-stream">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{s.name}</span>
        <Badge tone="info">{t(`kinds.${s.kind}`)}</Badge>
        {s.kind === "https" && s.format !== "ndjson" && <Badge tone="neutral">{t(`formats.${s.format}`)}</Badge>}
        {paused ? (
          <Badge tone="neutral">{t("paused")}</Badge>
        ) : s.health === "failing" ? (
          <Badge tone="danger">{t("failing")}</Badge>
        ) : (
          <Badge tone="success">{t("streaming")}</Badge>
        )}
      </div>
      <span dir="ltr" className="text-muted font-mono text-xs break-all">
        {destination(s)}
      </span>
      {s.actions.length > 0 && (
        <p className="text-muted text-xs" data-testid="audit-stream-actions">
          {t("only", { actions: s.actions.join(", ") })}
        </p>
      )}
      {s.health === "failing" && s.last_error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {s.next_attempt_at
            ? t("lastError", { error: s.last_error, when: fmt.dateTime(s.next_attempt_at, tz) })
            : s.last_error}
        </p>
      )}
      <p className="text-muted text-xs">
        {t("shipped", { count: s.shipped_count })}
        {" · "}
        {s.pending > 0 && s.oldest_pending_at
          ? t("pending", { count: s.pending, when: fmt.dateTime(s.oldest_pending_at, tz) })
          : t("upToDate")}
        {s.last_success_at && <> · {t("lastSent", { when: fmt.dateTime(s.last_success_at, tz) })}</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={test.isPending}
          onClick={() =>
            test.mutate(s.id, {
              onSuccess: (r) =>
                r.ok ? toast.success(t("testOk")) : toast.error(t("testFailed", { error: r.error ?? "" })),
            })
          }
        >
          <Send aria-hidden />
          {t("test")}
        </Button>
        {owner && (
          <>
            <Button
              size="sm"
              variant="ghost"
              loading={setStatus.isPending}
              onClick={() =>
                setStatus.mutate(
                  { id: s.id, status: paused ? "active" : "paused" },
                  {
                    onSuccess: () => {
                      track("security.audit_stream.status", { status: paused ? "active" : "paused" });
                      toast.success(paused ? t("resumed") : t("pausedToast"));
                    },
                    onError: (e) =>
                      toast.error(isApiError(e) && e.code === "plan_limit" ? t("errors.plan") : t("errors.failed")),
                  },
                )
              }
            >
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? t("resume") : t("pause")}
            </Button>
            {s.kind === "https" && (
              <Button
                size="sm"
                variant="ghost"
                loading={rotate.isPending}
                onClick={() => {
                  if (!window.confirm(t("rotateConfirm"))) return;
                  rotate.mutate(s.id, {
                    onSuccess: (r) => {
                      track("security.audit_stream.rotated");
                      if (r.secret) onSecret({ name: s.name, secret: r.secret });
                    },
                  });
                }}
              >
                <RefreshCw aria-hidden />
                {t("rotate")}
              </Button>
            )}
            {isCloudKind(s.kind) && (
              <ReplaceKey
                kind={s.kind}
                pending={replaceKey.isPending}
                onSave={(body, done) =>
                  replaceKey.mutate({ id: s.id, ...body }, { onSuccess: () => done(), onError: done })
                }
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto"
              aria-label={t("delete", { name: s.name })}
              onClick={() => {
                if (!window.confirm(t("deleteConfirm", { name: s.name, count: s.pending }))) return;
                remove.mutate(s.id, {
                  onSuccess: () => {
                    track("security.audit_stream.deleted");
                    toast.success(t("deleted"));
                  },
                });
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

const FIELDS = ["name", "url", "header_name", "header_value", "bucket", "region", "prefix", "actions"] as const;

function AddStream({
  kinds,
  principal,
  onCancel,
  onCreated,
}: {
  kinds: Kind[];
  principal: string;
  onCancel: () => void;
  onCreated: (name: string, secret: string | null) => void;
}) {
  const t = useTranslations("sso.streams");
  const { create } = useAuditStreamActions();
  const backfillId = useId();
  const [v, setV] = useState<AuditStreamInput>({ kind: kinds[0] ?? "https", name: "", backfill: false });
  const [actions, setActions] = useState("");
  const [cloud, setCloud] = useState<CloudValues>({});
  const [cloudErrors, setCloudErrors] = useState<CloudErrors>({});
  const toCloudErrors = useCloudErrors();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({});
  const set = (patch: Partial<AuditStreamInput>) => setV((cur) => ({ ...cur, ...patch }));
  const https = v.kind === "https";
  return (
    <form
      className="border-border grid gap-3 rounded-lg border p-3"
      noValidate
      data-testid="add-stream"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        setFieldErrors({});
        setCloudErrors({});
        const body: AuditStreamInput = isCloudKind(v.kind)
          ? { kind: v.kind, name: v.name.trim(), backfill: v.backfill, ...cloudBody(v.kind, cloud) }
          : https
            ? {
                kind: "https",
                format: v.format ?? "ndjson",
                name: v.name.trim(),
                url: v.url?.trim(),
                backfill: v.backfill,
              }
            : {
                kind: "s3",
                name: v.name.trim(),
                bucket: v.bucket?.trim(),
                region: v.region?.trim(),
                backfill: v.backfill,
              };
        if (https && v.header_name?.trim())
          Object.assign(body, { header_name: v.header_name.trim(), header_value: v.header_value });
        if (v.kind === "s3" && v.prefix?.trim()) body.prefix = v.prefix.trim();
        const only = actions
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
        if (only.length) body.actions = only;
        create.mutate(body, {
          onSuccess: (r) => {
            track("security.audit_stream.created", { kind: body.kind, backfill: !!body.backfill });
            toast.success(t("created"));
            onCreated(r.stream.name, r.secret);
          },
          onError: (e) => {
            if (!isApiError(e)) return setError(t("errors.failed"));
            if (e.code === "plan_limit") return setError(t("errors.plan"));
            if (e.code === "audit_stream_limit") return setError(t("errors.limit"));
            const ce = isCloudKind(v.kind) ? toCloudErrors(e) : null;
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("kind")}>
          <NativeSelect value={v.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("name")} error={fieldErrors.name}>
          <Input value={v.name} maxLength={80} placeholder="Splunk" onChange={(e) => set({ name: e.target.value })} />
        </Field>
      </div>
      {https ? (
        <>
          <Field label={t("format")} hint={t("formatHint")}>
            <NativeSelect
              value={v.format ?? "ndjson"}
              onChange={(e) => set({ format: e.target.value as AuditStream["format"] })}
            >
              {(["ndjson", "splunk_hec", "datadog"] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`formats.${f}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("url")} hint={t("urlHint")} error={fieldErrors.url}>
            <Input
              dir="ltr"
              type="url"
              value={v.url ?? ""}
              placeholder="https://siem.example.com/ingest"
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("headerName")} hint={t("headerHint")} error={fieldErrors.header_name}>
              <Input
                dir="ltr"
                value={v.header_name ?? ""}
                maxLength={64}
                placeholder="Authorization"
                onChange={(e) => set({ header_name: e.target.value })}
              />
            </Field>
            <Field label={t("headerValue")} error={fieldErrors.header_value}>
              <Input
                dir="ltr"
                type="password"
                autoComplete="off"
                value={v.header_value ?? ""}
                maxLength={2048}
                onChange={(e) => set({ header_value: e.target.value })}
              />
            </Field>
          </div>
        </>
      ) : isCloudKind(v.kind) ? (
        <CloudStorageFields
          kind={v.kind}
          value={cloud}
          onChange={(p) => setCloud((c) => ({ ...c, ...p }))}
          errors={cloudErrors}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("bucket")} error={fieldErrors.bucket}>
              <Input
                dir="ltr"
                value={v.bucket ?? ""}
                placeholder="acme-audit"
                onChange={(e) => set({ bucket: e.target.value })}
              />
            </Field>
            <Field label={t("region")} error={fieldErrors.region}>
              <Input
                dir="ltr"
                value={v.region ?? ""}
                placeholder="eu-west-1"
                onChange={(e) => set({ region: e.target.value })}
              />
            </Field>
            <Field label={t("prefix")} error={fieldErrors.prefix}>
              <Input
                dir="ltr"
                value={v.prefix ?? ""}
                placeholder="siem/"
                onChange={(e) => set({ prefix: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-muted text-xs">{t("s3Hint")}</p>
          {principal && <CopyValue label={t("principal")} value={principal} />}
        </>
      )}
      <Field label={t("actions")} hint={t("actionsHint")} error={fieldErrors.actions}>
        <Input
          dir="ltr"
          value={actions}
          placeholder="auth.*, lead.deleted"
          onChange={(e) => setActions(e.target.value)}
        />
      </Field>
      <div className="flex items-start justify-between gap-4">
        <span className="grid gap-0.5">
          <label htmlFor={backfillId} className="text-sm font-medium">
            {t("backfill")}
          </label>
          <span id={`${backfillId}-hint`} className="text-muted text-xs">
            {t("backfillHint")}
          </span>
        </span>
        <Switch
          id={backfillId}
          checked={!!v.backfill}
          aria-describedby={`${backfillId}-hint`}
          onCheckedChange={(b) => set({ backfill: b })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={create.isPending} disabled={!v.name.trim()}>
          {t("create")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
