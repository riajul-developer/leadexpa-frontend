"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

// Google Cloud Storage and Azure Blob Storage destinations (ADR 0056), shared by audit streams and warehouse
// exports: Cloud Storage takes a bucket and an HMAC key, Azure a container URL and a SAS token. Keys are write-only.

export type CloudKind = "gcs" | "azure_blob";
export const isCloudKind = (k: string): k is CloudKind => k === "gcs" || k === "azure_blob";

export type CloudValues = {
  bucket?: string;
  prefix?: string;
  container_url?: string;
  access_key?: string;
  storage_secret?: string;
};

export const CLOUD_FIELDS = ["bucket", "prefix", "container_url", "access_key", "storage_secret"] as const;
export type CloudErrors = Partial<Record<(typeof CLOUD_FIELDS)[number], string>>;

/** The request body fields for a Cloud Storage or Azure destination, trimmed. */
export function cloudBody(kind: CloudKind, v: CloudValues): CloudValues {
  const prefix = v.prefix?.trim() || undefined;
  return kind === "gcs"
    ? { bucket: v.bucket?.trim(), prefix, access_key: v.access_key?.trim(), storage_secret: v.storage_secret?.trim() }
    : { container_url: v.container_url?.trim(), prefix, storage_secret: v.storage_secret?.trim() };
}

/** Maps a 422's field errors to this component's messages; returns null when none of its fields are named. */
export function useCloudErrors() {
  const t = useTranslations("sso.storage");
  return (e: unknown): CloudErrors | null => {
    if (!isApiError(e)) return null;
    const out: CloudErrors = {};
    for (const f of CLOUD_FIELDS) if (e.fieldErrors[f]) out[f] = t(`errors.${f}`);
    return Object.keys(out).length ? out : null;
  };
}

export function CloudStorageFields({
  kind,
  value: v,
  onChange,
  errors = {},
}: {
  kind: CloudKind;
  value: CloudValues;
  onChange: (patch: CloudValues) => void;
  errors?: CloudErrors;
}) {
  const t = useTranslations("sso.storage");
  return (
    <div className="grid gap-3" data-testid={`storage-${kind}`}>
      {kind === "gcs" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("bucket")} error={errors.bucket}>
            <Input
              dir="ltr"
              value={v.bucket ?? ""}
              placeholder="acme_audit"
              onChange={(e) => onChange({ bucket: e.target.value })}
            />
          </Field>
          <Field label={t("prefix")} error={errors.prefix}>
            <Input
              dir="ltr"
              value={v.prefix ?? ""}
              placeholder="siem/"
              onChange={(e) => onChange({ prefix: e.target.value })}
            />
          </Field>
          <Field label={t("accessKey")} error={errors.access_key}>
            <Input
              dir="ltr"
              autoComplete="off"
              value={v.access_key ?? ""}
              placeholder="GOOG1E…"
              onChange={(e) => onChange({ access_key: e.target.value })}
            />
          </Field>
          <Field label={t("hmacSecret")} error={errors.storage_secret}>
            <Input
              dir="ltr"
              type="password"
              autoComplete="off"
              value={v.storage_secret ?? ""}
              onChange={(e) => onChange({ storage_secret: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={t("containerUrl")} error={errors.container_url}>
                <Input
                  dir="ltr"
                  type="url"
                  value={v.container_url ?? ""}
                  placeholder="https://acme.blob.core.windows.net/audit"
                  onChange={(e) => onChange({ container_url: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("prefix")} error={errors.prefix}>
              <Input
                dir="ltr"
                value={v.prefix ?? ""}
                placeholder="siem/"
                onChange={(e) => onChange({ prefix: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("sasToken")} error={errors.storage_secret}>
            <Input
              dir="ltr"
              type="password"
              autoComplete="off"
              value={v.storage_secret ?? ""}
              placeholder="sv=…&sp=cw&sig=…"
              onChange={(e) => onChange({ storage_secret: e.target.value })}
            />
          </Field>
        </>
      )}
      <p className="text-muted text-xs">{kind === "gcs" ? t("gcsHint") : t("azureHint")}</p>
    </div>
  );
}

/** Replace a destination's HMAC key or SAS token (they expire or get rotated); the destination stays. */
export function ReplaceKey({
  kind,
  pending,
  onSave,
}: {
  kind: CloudKind;
  pending: boolean;
  onSave: (body: { access_key?: string; storage_secret: string }, done: (err?: unknown) => void) => void;
}) {
  const t = useTranslations("sso.storage");
  const toErrors = useCloudErrors();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CloudValues>({});
  const [errors, setErrors] = useState<CloudErrors>({});
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden />
        {t("replaceKey")}
      </Button>
    );
  }
  return (
    <form
      className="border-border grid w-full gap-2 rounded-lg border p-3"
      noValidate
      data-testid="replace-key"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        const body = {
          storage_secret: v.storage_secret?.trim() ?? "",
          ...(kind === "gcs" && v.access_key?.trim() ? { access_key: v.access_key.trim() } : {}),
        };
        onSave(body, (err) => {
          if (!err) {
            toast.success(t("keyReplaced"));
            setOpen(false);
            setV({});
            return;
          }
          const fe = toErrors(err);
          if (fe) setErrors(fe);
          else toast.error(t("errors.failed"));
        });
      }}
    >
      {kind === "gcs" && (
        <Field label={t("accessKey")} hint={t("accessKeyKeep")} error={errors.access_key}>
          <Input
            dir="ltr"
            autoComplete="off"
            value={v.access_key ?? ""}
            onChange={(e) => setV({ ...v, access_key: e.target.value })}
          />
        </Field>
      )}
      <Field label={kind === "gcs" ? t("hmacSecret") : t("sasToken")} error={errors.storage_secret}>
        <Input
          dir="ltr"
          type="password"
          autoComplete="off"
          value={v.storage_secret ?? ""}
          onChange={(e) => setV({ ...v, storage_secret: e.target.value })}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending} disabled={!v.storage_secret?.trim()}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Where a destination writes, as its own tools name it. */
export function cloudLocation(kind: string, d: { bucket: string; prefix: string; container_url: string }): string {
  if (kind === "gcs") return `gs://${d.bucket}/${d.prefix}`;
  if (kind === "azure_blob") return `${d.container_url}/${d.prefix}`;
  return `s3://${d.bucket}/${d.prefix}`;
}
