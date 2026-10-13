"use client";

import { ArrowLeft, Pause, Play, Plus, RotateCw, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { DialogModal } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  useConnectorCatalog,
  useConnectorInstall,
  useRemoveConnectorInstall,
  useRotateConnectorInstall,
  useUpdateConnectorInstall,
  type ConnectorCredentials,
  type ConnectorDelivery,
  type ConnectorInstallDetail,
  type ConnectorManifest,
} from "./api";
import { CredentialsPanel, HealthBadge } from "./parts";

const RESULTS = ["accepted", "duplicate", "test", "rejected", "unauthorized"] as const;
const RESULT_TONE = {
  accepted: "success",
  duplicate: "neutral",
  test: "primary",
  rejected: "danger",
  unauthorized: "danger",
} as const;

/** /integrations/sources/[id]: one connector's health, deliveries, field mapping and credentials. */
export function ConnectorInstallPage({ id }: { id: string }) {
  const t = useTranslations("connectors");
  const q = useConnectorInstall(id);
  const catalog = useConnectorCatalog();
  const canManage = useCan("integration.manage");

  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  if (!q.data)
    return (
      <EmptyState
        title={t("notFound")}
        action={
          <Button variant="secondary" asChild>
            <Link href="/integrations">{t("back")}</Link>
          </Button>
        }
      />
    );
  const install = q.data;
  const manifest = catalog.data?.data.find((m) => m.key === install.connector);

  return (
    <div className="grid gap-4">
      <Link href="/integrations" className="text-muted hover:text-text flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("back")}
      </Link>
      <Overview install={install} manifest={manifest} canManage={canManage} />
      <Deliveries install={install} />
      {canManage && manifest?.mappable && (
        <MappingCard key={install.id + JSON.stringify(install.field_map)} install={install} manifest={manifest} />
      )}
    </div>
  );
}

function Overview({
  install,
  manifest,
  canManage,
}: {
  install: ConnectorInstallDetail;
  manifest?: ConnectorManifest;
  canManage: boolean;
}) {
  const t = useTranslations("connectors");
  const te = useTranslations("errors");
  const f = useFormat();
  const now = useNow();
  const router = useRouter();
  const { clients } = useClients();
  const update = useUpdateConnectorInstall(install.id);
  const rotate = useRotateConnectorInstall(install.id);
  const remove = useRemoveConnectorInstall(install.id, install.client_id);
  const [rotated, setRotated] = useState<ConnectorCredentials | null>(null);
  const fail = (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
  const paused = install.status === "paused";

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            <span className="truncate">{install.name}</span>
            <HealthBadge install={install} />
          </h1>
          <p className="text-muted text-sm">
            {manifest?.name ?? install.connector} · {clients.find((c) => c.id === install.client_id)?.name}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { status: paused ? "active" : "paused" },
                  {
                    onSuccess: (r) => toast.success(t(r.status === "paused" ? "pausedToast" : "resumedToast")),
                    onError: fail,
                  },
                )
              }
            >
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? t("resume") : t("pause")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={rotate.isPending}
              onClick={() =>
                window.confirm(t("rotateConfirm")) &&
                rotate.mutate(undefined, { onSuccess: (r) => setRotated(r.credentials), onError: fail })
              }
            >
              <RotateCw aria-hidden />
              {t("rotate")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={remove.isPending}
              onClick={() =>
                window.confirm(t("removeConfirm")) &&
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t("removed"));
                    router.push("/integrations");
                  },
                  onError: fail,
                })
              }
            >
              <Trash2 aria-hidden />
              {t("remove")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted text-xs">{t("endpoint")}</dt>
            <dd className="truncate font-mono text-xs" dir="ltr">
              {install.endpoint}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("lastSuccess")}</dt>
            <dd>{install.last_success_at ? f.relative(install.last_success_at, now || Date.now()) : t("never")}</dd>
          </div>
          {install.health !== "healthy" && install.last_error && (
            <div className="sm:col-span-2">
              <dt className="text-muted text-xs">{t("lastError", { count: install.consecutive_failures })}</dt>
              <dd className="text-danger">{install.last_error}</dd>
            </div>
          )}
        </dl>
        <div>
          <h2 className="mb-2 text-sm font-medium">{t("last24h")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RESULTS.map((r) => (
              <li key={r} className="border-border rounded-lg border p-2">
                <p className="text-muted text-xs">{t(`result.${r}`)}</p>
                <p className="text-lg font-semibold tabular-nums">{f.number(install.last_24h[r] ?? 0)}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-muted text-sm">{t(`testHint.${testKey(install.connector)}`)}</p>
      </CardContent>
      {rotated && (
        <DialogModal open onOpenChange={(o) => !o && setRotated(null)} title={t("rotatedTitle")}>
          <CredentialsPanel connector={install.connector} credentials={rotated} />
          <div className="flex justify-end">
            <Button onClick={() => setRotated(null)}>{t("add.done")}</Button>
          </div>
        </DialogModal>
      )}
    </Card>
  );
}

function testKey(connector: string) {
  return connector === "google_ads" || connector === "inbound_api" ? connector : "webhook";
}

function Deliveries({ install }: { install: ConnectorInstallDetail }) {
  const t = useTranslations("connectors");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("deliveries")}</CardTitle>
          <p className="text-muted text-sm">{t("deliveriesHint")}</p>
        </div>
      </CardHeader>
      <CardContent>
        {install.deliveries.length === 0 ? (
          <EmptyState title={t("noDeliveries")} description={t("noDeliveriesHint")} />
        ) : (
          <ul className="divide-border grid divide-y text-sm">
            {install.deliveries.map((d) => (
              <DeliveryRow key={d.id} d={d} when={f.dateTime(d.received_at, tz, "short")} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeliveryRow({ d, when }: { d: ConnectorDelivery; when: string }) {
  const t = useTranslations("connectors");
  const preview = d.preview ? Object.entries(d.preview) : [];
  return (
    <li className="grid gap-1 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={RESULT_TONE[d.result]}>{t(`result.${d.result}`)}</Badge>
        <span className="text-muted text-xs">{when}</span>
        {d.external_id && (
          <code className="text-muted truncate text-xs" dir="ltr">
            {d.external_id}
          </code>
        )}
        {d.inbound_event_id && d.result === "accepted" && <span className="text-muted text-xs">{t("stored")}</span>}
      </div>
      {d.error && <p className="text-danger text-xs">{d.error}</p>}
      {preview.length > 0 && (
        <details className="text-xs">
          <summary className="text-primary cursor-pointer">{t("preview")}</summary>
          <dl className="bg-surface-2 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded p-2">
            {preview.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{t.has(`field.${fieldKey(k)}`) ? t(`field.${fieldKey(k)}`) : k}</dt>
                <dd className="truncate" dir="auto">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </li>
  );
}

/** "_ignore" and "custom.x" are mapping targets, not message keys. */
function fieldKey(target: string) {
  return target === "_ignore" ? "ignore" : target.startsWith("custom.") ? "custom" : target;
}

type Row = { path: string; target: string; custom: string };

function toRows(map: Record<string, string>): Row[] {
  return Object.entries(map).map(([path, target]) =>
    target.startsWith("custom.") ? { path, target: "custom", custom: target.slice(7) } : { path, target, custom: "" },
  );
}

/** Incoming field path → lead field. Unmapped fields keep their name (common names are recognised). */
function MappingCard({ install, manifest }: { install: ConnectorInstallDetail; manifest: ConnectorManifest }) {
  const t = useTranslations("connectors.mapping");
  const tf = useTranslations("connectors.field");
  const te = useTranslations("errors");
  const update = useUpdateConnectorInstall(install.id);
  const [name, setName] = useState(install.name);
  const [rows, setRows] = useState<Row[]>(() => toRows(install.field_map));
  const [idField, setIdField] = useState(install.settings.id_field ?? "");
  const [testField, setTestField] = useState(install.settings.test_field ?? "");
  const isWebhook = install.connector === "webhook";
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const field_map: Record<string, string> = {};
    for (const r of rows) {
      const path = r.path.trim();
      if (!path) continue;
      const custom = r.custom.trim();
      if (r.target === "custom" && !custom) continue;
      field_map[path] = r.target === "custom" ? `custom.${custom}` : r.target;
    }
    const settings: Record<string, string> = {};
    if (idField.trim()) settings.id_field = idField.trim();
    if (testField.trim()) settings.test_field = testField.trim();
    update.mutate(
      { name: name.trim() || install.name, field_map, ...(isWebhook ? { settings } : {}) },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (err) =>
          toast.error(
            isApiError(err) && err.status === 422
              ? te("validation_failed")
              : isApiError(err) && te.has(err.code)
                ? te(err.code)
                : te("internal"),
          ),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={save}>
          <Field label={t("name")} className="max-w-sm">
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("fields")}</legend>
            {rows.length === 0 && <p className="text-muted text-sm">{t("none")}</p>}
            {rows.map((r, i) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={r.path}
                  onChange={(e) => set(i, { path: e.target.value })}
                  placeholder={t("pathPlaceholder")}
                  aria-label={t("path", { n: i + 1 })}
                  dir="ltr"
                />
                <div className="flex gap-2">
                  <NativeSelect
                    value={r.target}
                    onChange={(e) => set(i, { target: e.target.value })}
                    aria-label={t("target", { n: i + 1 })}
                  >
                    {manifest.targets.map((x) => (
                      <option key={x} value={x}>
                        {tf.has(fieldKey(x)) ? tf(fieldKey(x)) : x}
                      </option>
                    ))}
                    <option value="custom">{tf("custom")}</option>
                  </NativeSelect>
                  {r.target === "custom" && (
                    <Input
                      value={r.custom}
                      onChange={(e) => set(i, { custom: e.target.value })}
                      placeholder={t("customPlaceholder")}
                      aria-label={t("customKey", { n: i + 1 })}
                      dir="ltr"
                    />
                  )}
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("removeRow", { n: i + 1 })}
                  onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                >
                  <X aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-fit"
              onClick={() =>
                setRows((x) => [...x, { path: "", target: manifest.targets[0] ?? "full_name", custom: "" }])
              }
            >
              <Plus aria-hidden />
              {t("addRow")}
            </Button>
          </fieldset>
          {isWebhook && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("idField")} hint={t("idFieldHint")}>
                <Input value={idField} onChange={(e) => setIdField(e.target.value)} dir="ltr" />
              </Field>
              <Field label={t("testField")} hint={t("testFieldHint")}>
                <Input value={testField} onChange={(e) => setTestField(e.target.value)} dir="ltr" />
              </Field>
            </div>
          )}
          <Button type="submit" className="w-fit" loading={update.isPending}>
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
