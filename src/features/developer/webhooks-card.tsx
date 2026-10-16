"use client";

import { ChevronDown, Plus, RotateCcw, Send, Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Checkbox, Dialog, DialogContent } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type DeliveryStatus,
  type WebhookEndpoint,
  type WebhookEventType,
  useCreateEndpoint,
  useDeleteEndpoint,
  useDeliveries,
  useDelivery,
  useDeveloperCatalog,
  useReplayDelivery,
  useRotateSecret,
  useTestEndpoint,
  useUpdateEndpoint,
  useWebhookEndpoints,
} from "./api";
import { DeliveryStatusBadge, EndpointStatusBadge, SecretOnce, useEventLabel } from "./parts";

/** Outgoing webhooks: signed events to the agency's own systems, with a delivery log and resend. */
export function WebhooksCard() {
  const t = useTranslations("developer.webhooks");
  const { data, isPending } = useWebhookEndpoints();
  const [open, setOpen] = useState(false);
  const endpoints = data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <Webhook className="text-accent size-4" aria-hidden />
            {t("title")}
          </CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : endpoints.length === 0 ? (
          <EmptyState icon={Webhook} title={t("emptyTitle")} description={t("emptyHint")} className="py-8" />
        ) : (
          endpoints.map((e) => <EndpointItem key={e.id} endpoint={e} />)
        )}
        <details className="bg-surface-2 rounded-lg p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("verifyTitle")}</summary>
          <p className="text-muted mt-2">{t("verifyHint")}</p>
          <pre className="bg-surface mt-2 overflow-x-auto rounded p-2 text-xs" dir="ltr">
            {`X-Recov-Signature: t=<unix>,v1=<hex>\nv1 == HMAC_SHA256(secret, "<unix>." + body)\nX-Recov-Event-Id: <dedupe on this>`}
          </pre>
        </details>
      </CardContent>
      {open && <NewEndpointDialog onClose={() => setOpen(false)} />}
    </Card>
  );
}

function EndpointItem({ endpoint: e }: { endpoint: WebhookEndpoint }) {
  const t = useTranslations("developer.webhooks");
  const label = useEventLabel();
  const [expanded, setExpanded] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const update = useUpdateEndpoint(e.id);
  const remove = useDeleteEndpoint();
  const rotate = useRotateSecret(e.id);
  const test = useTestEndpoint(e.id);
  const panel = `endpoint-${e.id}`;
  return (
    <div className="border-border rounded-lg border">
      <button
        type="button"
        className="hover:bg-surface-2 flex w-full items-start gap-3 rounded-lg p-3 text-start"
        aria-expanded={expanded}
        aria-controls={panel}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <code className="truncate text-sm font-medium" dir="ltr">
              {e.url}
            </code>
            <EndpointStatusBadge endpoint={e} />
          </p>
          <p className="text-muted text-xs">
            {e.description && `${e.description} · `}
            {e.events.map(label).join(", ")}
            {e.consecutive_failures > 0 && ` · ${t("failures", { n: e.consecutive_failures })}`}
          </p>
        </div>
        <ChevronDown
          className={cn("text-muted mt-1 size-4 shrink-0 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded && (
        <div id={panel} className="border-border grid gap-3 border-t p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={test.isPending}
              onClick={() =>
                test.mutate(undefined, {
                  onSuccess: (d) =>
                    d.status === "succeeded"
                      ? toast.success(t("testOk", { code: d.response_status ?? 0 }))
                      : toast.error(t("testFailed", { error: d.error ?? "" })),
                })
              }
            >
              <Send aria-hidden />
              {t("test")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={update.isPending}
              onClick={() => update.mutate({ status: e.status === "active" ? "disabled" : "active" })}
            >
              {e.status === "active" ? t("disable") : t("enable")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={rotate.isPending}
              onClick={() =>
                window.confirm(t("rotateConfirm")) &&
                rotate.mutate(undefined, { onSuccess: (r) => setSecret(r.secret) })
              }
            >
              {t("rotate")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger ms-auto"
              loading={remove.isPending}
              onClick={() => window.confirm(t("deleteConfirm")) && remove.mutate(e.id)}
            >
              {t("delete")}
            </Button>
          </div>
          {secret && (
            <SecretOnce label={t("secretLabel")} value={secret}>
              <Button size="sm" variant="secondary" onClick={() => setSecret(null)}>
                {t("done")}
              </Button>
            </SecretOnce>
          )}
          <DeliveryLog endpointId={e.id} />
        </div>
      )}
    </div>
  );
}

const FILTERS: (DeliveryStatus | undefined)[] = [undefined, "failed", "pending", "succeeded"];

function DeliveryLog({ endpointId }: { endpointId: string }) {
  const t = useTranslations("developer.deliveries");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const label = useEventLabel();
  const [status, setStatus] = useState<DeliveryStatus | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isPending } = useDeliveries(endpointId, status);
  const rows = data?.data ?? [];
  return (
    <section className="grid gap-2" aria-label={t("title")}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <div className="ms-auto flex gap-1" role="group" aria-label={t("filter")}>
          {FILTERS.map((s) => (
            <Button
              key={s ?? "all"}
              size="sm"
              variant={status === s ? "primary" : "secondary"}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s ? t(`status.${s}`) : t("all")}
            </Button>
          ))}
        </div>
      </div>
      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted py-4 text-center text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-border grid divide-y text-sm">
          {rows.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="hover:bg-surface-2 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-2 text-start"
                onClick={() => setOpen(d.id)}
              >
                <DeliveryStatusBadge status={d.status} code={d.response_status} />
                <span className="font-medium">{label(d.event_type)}</span>
                {d.replay_of && <span className="text-muted text-xs">{t("resent")}</span>}
                <span className="text-muted ms-auto text-xs tabular-nums">
                  {f.dateTime(d.created_at, tz, "short")} · {t("attempts", { n: d.attempts })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted text-xs">{t("retention")}</p>
      {open && <DeliveryDialog id={open} endpointId={endpointId} onClose={() => setOpen(null)} />}
    </section>
  );
}

function DeliveryDialog({ id, endpointId, onClose }: { id: string; endpointId: string; onClose: () => void }) {
  const t = useTranslations("developer.deliveries");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const label = useEventLabel();
  const { data: d } = useDelivery(id);
  const replay = useReplayDelivery(endpointId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={d ? label(d.event_type) : t("title")} className="max-w-2xl">
        {!d ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="grid gap-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">{t("statusLabel")}</dt>
              <dd>
                <DeliveryStatusBadge status={d.status} code={d.response_status} />
              </dd>
              <dt className="text-muted">{t("sent")}</dt>
              <dd className="tabular-nums">{f.dateTime(d.created_at, tz, "datetime")}</dd>
              <dt className="text-muted">{t("attemptsLabel")}</dt>
              <dd>
                {d.attempts}
                {d.next_attempt_at && ` · ${t("nextAttempt", { when: f.dateTime(d.next_attempt_at, tz, "short") })}`}
              </dd>
              {d.duration_ms != null && (
                <>
                  <dt className="text-muted">{t("duration")}</dt>
                  <dd className="tabular-nums">{t("ms", { n: d.duration_ms })}</dd>
                </>
              )}
              {d.error && (
                <>
                  <dt className="text-muted">{t("error")}</dt>
                  <dd className="text-danger">{d.error}</dd>
                </>
              )}
              <dt className="text-muted">{t("eventId")}</dt>
              <dd>
                <code className="text-xs" dir="ltr">
                  {d.event_id}
                </code>
              </dd>
            </dl>
            <Payload title={t("body")} text={JSON.stringify(d.payload ?? {}, null, 2)} />
            {d.response_body && <Payload title={t("response")} text={d.response_body} />}
            <div className="flex justify-end gap-2">
              <Button
                loading={replay.isPending}
                onClick={() =>
                  replay.mutate(d.id, {
                    onSuccess: (r) =>
                      r.status === "succeeded" ? toast.success(t("resendOk")) : toast.error(t("resendFailed")),
                  })
                }
              >
                <RotateCcw aria-hidden />
                {t("resend")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Payload({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted text-xs font-medium">{title}</span>
      <pre className="bg-surface-2 max-h-64 overflow-auto rounded-lg p-2 text-xs" dir="ltr">
        {text}
      </pre>
    </div>
  );
}

function NewEndpointDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("developer.webhooks");
  const label = useEventLabel();
  const { data: catalog } = useDeveloperCatalog();
  const { clients } = useClients();
  const create = useCreateEndpoint();
  const [url, setUrl] = useState("https://");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>(["lead.created"]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);
  const created = create.data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    create.mutate(
      { url: url.trim(), description: description.trim(), events, client_ids: clientIds },
      {
        onError: (err) =>
          isApiError(err) && err.fieldErrors.url
            ? setUrlError(t("urlInvalid"))
            : toast.error(isApiError(err) ? err.message : t("failed")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={created ? t("createdTitle") : t("new")} description={created ? undefined : t("newHint")}>
        {created ? (
          <SecretOnce label={t("secretLabel")} value={created.secret}>
            <Button onClick={onClose}>{t("done")}</Button>
          </SecretOnce>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <Field label={t("url")} hint={t("urlHint")} error={urlError ?? undefined}>
              <Input
                type="url"
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                maxLength={2000}
              />
            </Field>
            <Field label={t("description")}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </Field>
            <CheckList
              legend={t("events")}
              items={(catalog?.events ?? []).map((ev) => ({ id: ev, label: label(ev), sub: ev }))}
              selected={events}
              onChange={(v) => setEvents(v as WebhookEventType[])}
            />
            <CheckList
              legend={t("clients")}
              hint={t("clientsHint")}
              items={clients.map((c) => ({ id: c.id, label: c.name }))}
              selected={clientIds}
              onChange={setClientIds}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={create.isPending} disabled={events.length === 0}>
                {t("create")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckList({
  legend,
  hint,
  items,
  selected,
  onChange,
}: {
  legend: string;
  hint?: string;
  items: { id: string; label: string; sub?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint && <p className="text-muted mb-1 text-xs">{hint}</p>}
      <div className="grid max-h-52 gap-1 overflow-y-auto sm:grid-cols-2">
        {items.map((it) => (
          <label
            key={it.id}
            className="hover:bg-surface-2 flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm"
          >
            <Checkbox
              className="mt-0.5"
              checked={selected.includes(it.id)}
              onCheckedChange={(on) => onChange(on ? [...selected, it.id] : selected.filter((x) => x !== it.id))}
              aria-label={it.label}
            />
            <span className="grid">
              {it.label}
              {it.sub && (
                <code className="text-muted text-[0.7rem]" dir="ltr">
                  {it.sub}
                </code>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
