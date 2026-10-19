"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2Off, Megaphone, MessageCircle, RefreshCw, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { metaKeys } from "@/shared/lib/query-keys";
import { useCan, useFlag } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { Checkbox, Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, Spinner } from "@/shared/ui/primitives";

type Connection = Schemas["MetaConnection"];
type AvailablePage = Schemas["MetaAvailablePage"];

const CALLBACK_MESSAGE = "recov-meta-callback";

function healthTone(c: Connection) {
  if (c.status !== "active") return "danger" as const;
  return c.health === "healthy"
    ? ("success" as const)
    : c.health === "degraded"
      ? ("warning" as const)
      : ("danger" as const);
}

export function MetaIntegration() {
  const t = useTranslations("meta");
  const canManage = useCan("integration.manage");
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: metaKeys.overview, queryFn: () => unwrap(api.GET("/v1/integrations/meta")) });
  const [choose, setChoose] = useState<{ connectionId: string; pages: AvailablePage[] } | null>(null);
  const dmCapture = useFlag("dm_capture");

  const connect = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/integrations/meta/connect")),
    onSuccess: ({ authorize_url }) => {
      track("integration.meta.connect_started");
      const w = 600;
      const h = 720;
      const popup = window.open(
        authorize_url,
        "recov-meta",
        `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`,
      );
      if (!popup) window.location.assign(authorize_url); // popup blocked: full-page flow returns to the callback page
    },
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent<{ type?: string; connectionId?: string; pages?: AvailablePage[] }>) => {
      if (e.origin !== window.location.origin || e.data?.type !== CALLBACK_MESSAGE) return;
      void qc.invalidateQueries({ queryKey: metaKeys.overview });
      if (e.data.connectionId && e.data.pages) setChoose({ connectionId: e.data.connectionId, pages: e.data.pages });
    };
    window.addEventListener("message", onMessage);
    // Popup blocked: the callback page left the result in sessionStorage.
    try {
      const saved = sessionStorage.getItem("recov-meta-pages");
      if (saved) {
        sessionStorage.removeItem("recov-meta-pages");
        const p = JSON.parse(saved) as { connectionId: string; pages: AvailablePage[] };
        setChoose({ connectionId: p.connectionId, pages: p.pages });
      }
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  if (overview.isPending) return <Skeleton className="h-64 w-full" />;
  const o = overview.data;
  if (!o?.configured)
    return <EmptyState icon={Megaphone} title={t("unconfigured")} description={t("unconfiguredHint")} />;
  const hasConnection = o.connections.some((c) => c.status !== "revoked");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <p className="text-muted text-sm">{t("hint")}</p>
          </div>
          {canManage && (
            <Button onClick={() => connect.mutate()} loading={connect.isPending}>
              <Megaphone aria-hidden />
              {hasConnection ? t("connectAnother") : t("connect")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {o.connections.filter((c) => c.status !== "revoked").length === 0 ? (
            <p className="text-muted text-sm">{t("noConnection")}</p>
          ) : (
            o.connections
              .filter((c) => c.status !== "revoked")
              .map((c) => <ConnectionCard key={c.id} c={c} onReconnect={() => connect.mutate()} onChoose={setChoose} />)
          )}
        </CardContent>
      </Card>
      {o.forms.length > 0 && <FormsCard forms={o.forms} pages={o.pages} />}
      {o.messaging_available && dmCapture && o.pages.some((p) => p.status === "active") && (
        <MessagingCard pages={o.pages.filter((p) => p.status === "active")} />
      )}
      <UnroutedCard forms={o.forms} />
      {choose && <ChoosePagesDialog {...choose} onClose={() => setChoose(null)} />}
    </div>
  );
}

function ConnectionCard({
  c,
  onReconnect,
  onChoose,
}: {
  c: Connection;
  onReconnect: () => void;
  onChoose: (v: { connectionId: string; pages: AvailablePage[] }) => void;
}) {
  const t = useTranslations("meta.connection");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const canManage = useCan("integration.manage");
  const daysLeft = c.token_expires_at
    ? Math.ceil((Date.parse(c.token_expires_at) - (now || Date.now())) / 86400_000)
    : null;
  const pages = useMutation({
    mutationFn: () =>
      unwrap(
        api.GET("/v1/integrations/meta/connections/{connectionId}/available-pages", {
          params: { path: { connectionId: c.id } },
        }),
      ),
    onSuccess: (r) => onChoose({ connectionId: c.id, pages: r.data }),
  });
  const disconnect = useMutation({
    mutationFn: () =>
      unwrapEmpty(
        api.DELETE("/v1/integrations/meta/connections/{connectionId}", { params: { path: { connectionId: c.id } } }),
      ),
    onSuccess: () => {
      track("integration.meta.disconnected");
      void qc.invalidateQueries({ queryKey: metaKeys.overview });
    },
  });
  const tone = healthTone(c);
  return (
    <div className="border-border grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{c.fb_user_name}</span>
        <Badge tone={tone}>
          {tone === "success" ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
          {c.status !== "active" ? t(`status.${c.status}`) : t(`health.${c.health}`)}
        </Badge>
        {daysLeft != null && c.status === "active" && daysLeft <= 7 && (
          <Badge tone="warning">{t("expiresIn", { days: Math.max(0, daysLeft) })}</Badge>
        )}
        <span className="text-muted text-sm">· {t("pages", { count: c.page_count })}</span>
      </div>
      <p className="text-muted text-xs">
        {c.last_success_at
          ? t("lastSuccess", { when: f.relative(c.last_success_at, now || Date.now()) })
          : t("neverSucceeded")}
        {c.last_error && c.health !== "healthy" && ` · ${t("lastError")}: ${c.last_error}`}
      </p>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {c.status !== "active" || c.health === "down" || (daysLeft != null && daysLeft <= 7) ? (
            <Button size="sm" onClick={onReconnect}>
              <RefreshCw aria-hidden />
              {t("reconnect")}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => pages.mutate()} loading={pages.isPending}>
              {t("choosePages")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.confirm(t("disconnectConfirm")) && disconnect.mutate()}
            loading={disconnect.isPending}
          >
            <Unplug aria-hidden />
            {t("disconnect")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChoosePagesDialog({
  connectionId,
  pages,
  onClose,
}: {
  connectionId: string;
  pages: AvailablePage[];
  onClose: () => void;
}) {
  const t = useTranslations("meta.pages");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>(
    pages.filter((p) => !p.connected && p.can_manage_leads).map((p) => p.page_id),
  );
  const subscribe = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/integrations/meta/connections/{connectionId}/pages", {
          params: { path: { connectionId } },
          body: { page_ids: picked },
        }),
      ),
    meta: { silent: true },
    onSuccess: (r) => {
      track("integration.meta.pages_connected", { count: r.data.length });
      toast.success(t("connected", { count: r.data.length }));
      void qc.invalidateQueries({ queryKey: metaKeys.overview });
      onClose();
    },
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("title")} description={t("hint")}>
        {pages.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <ul className="grid gap-2">
            {pages.map((p) => (
              <li key={p.page_id}>
                <label className="border-border flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox
                    checked={picked.includes(p.page_id) || p.connected}
                    disabled={p.connected || !p.can_manage_leads}
                    onCheckedChange={(v) =>
                      setPicked(v ? [...picked, p.page_id] : picked.filter((x) => x !== p.page_id))
                    }
                  />
                  <span className="flex-1">{p.name}</span>
                  {p.connected && <Badge tone="success">{t("alreadyConnected")}</Badge>}
                  {!p.can_manage_leads && <Badge tone="warning">{t("noLeadAccess")}</Badge>}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("later")}
          </Button>
          <Button disabled={picked.length === 0} onClick={() => subscribe.mutate()} loading={subscribe.isPending}>
            {t("connect", { count: picked.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormsCard({ forms, pages }: { forms: Schemas["MetaForm"][]; pages: Schemas["MetaPage"][] }) {
  const t = useTranslations("meta.forms");
  const qc = useQueryClient();
  const canManage = useCan("integration.manage");
  const { clients, byId } = useClients();
  const pageName = new Map(pages.map((p) => [p.id, p.name]));
  const map = useMutation({
    mutationFn: ({ formRef, clientId }: { formRef: string; clientId: string }) =>
      unwrap(
        api.PUT("/v1/integrations/meta/forms/{formRef}/mapping", {
          params: { path: { formRef } },
          body: { client_id: clientId },
        }),
      ),
    onSuccess: (f) => {
      track("integration.meta.form_mapped");
      toast.success(t("mapped", { client: byId.get(f.client_id ?? "")?.name ?? "" }));
      void qc.invalidateQueries({ queryKey: metaKeys.overview });
      void qc.invalidateQueries({ queryKey: metaKeys.unrouted });
    },
  });
  const unmap = useMutation({
    mutationFn: (formRef: string) =>
      unwrap(api.DELETE("/v1/integrations/meta/forms/{formRef}/mapping", { params: { path: { formRef } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: metaKeys.overview }),
  });
  const sync = useMutation({
    mutationFn: (pageRef: string) =>
      unwrap(api.POST("/v1/integrations/meta/pages/{pageRef}/sync-forms", { params: { path: { pageRef } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: metaKeys.overview }),
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        {canManage && pages.filter((p) => p.status === "active").length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => pages.filter((p) => p.status === "active").forEach((p) => sync.mutate(p.id))}
            loading={sync.isPending}
          >
            <RefreshCw aria-hidden />
            {t("sync")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-muted text-start">
              <th scope="col" className="py-2 font-medium">
                {t("form")}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t("page")}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t("client")}
              </th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id} className="border-border border-t">
                <th scope="row" className="py-2 text-start font-normal">
                  {f.name}
                  {f.unrouted_count > 0 && (
                    <Badge tone="warning" className="ms-2">
                      {t("waiting", { count: f.unrouted_count })}
                    </Badge>
                  )}
                </th>
                <td className="text-muted py-2">{pageName.get(f.page_ref) ?? "—"}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <NativeSelect
                      className="h-8"
                      value={f.client_id ?? ""}
                      disabled={!canManage || map.isPending}
                      onChange={(e) =>
                        e.target.value ? map.mutate({ formRef: f.id, clientId: e.target.value }) : unmap.mutate(f.id)
                      }
                      aria-label={t("clientFor", { form: f.name })}
                    >
                      <option value="">{t("unmapped")}</option>
                      {clients
                        .filter((c) => c.status === "active")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </NativeSelect>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function MessagingCard({ pages }: { pages: Schemas["MetaPage"][] }) {
  const t = useTranslations("meta.messaging");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const canManage = useCan("integration.manage");
  const { clients } = useClients();
  const save = useMutation({
    mutationFn: ({ pageRef, clientId, instagram }: { pageRef: string; clientId: string | null; instagram: boolean }) =>
      unwrap(
        api.PUT("/v1/integrations/meta/pages/{pageRef}/messaging", {
          params: { path: { pageRef } },
          body: { client_id: clientId, instagram },
        }),
      ),
    meta: { silent: true },
    onSuccess: (p) => {
      track("integration.meta.messaging_updated", { on: !!p.dm_client_id, instagram: p.instagram_enabled });
      toast.success(p.dm_client_id ? t("on") : t("off"));
      void qc.invalidateQueries({ queryKey: metaKeys.overview });
    },
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4" aria-hidden />
            {t("title")}
          </CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pages.map((p) => (
          <div key={p.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <NativeSelect
              className="h-8 w-auto"
              value={p.dm_client_id ?? ""}
              disabled={!canManage || save.isPending}
              aria-label={t("clientFor", { page: p.name })}
              onChange={(e) =>
                save.mutate({ pageRef: p.id, clientId: e.target.value || null, instagram: p.instagram_enabled })
              }
            >
              <option value="">{t("offOption")}</option>
              {clients
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </NativeSelect>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={p.instagram_enabled}
                disabled={!canManage || !p.dm_client_id || save.isPending}
                onCheckedChange={(v) => save.mutate({ pageRef: p.id, clientId: p.dm_client_id, instagram: v === true })}
              />
              {t("instagram")}
            </label>
          </div>
        ))}
        <p className="text-muted text-xs">{t("windowNote")}</p>
      </CardContent>
    </Card>
  );
}

function UnroutedCard({ forms }: { forms: Schemas["MetaForm"][] }) {
  const t = useTranslations("meta.unrouted");
  const f = useFormat();
  const now = useNow();
  const q = useQuery({ queryKey: metaKeys.unrouted, queryFn: () => unwrap(api.GET("/v1/integrations/meta/unrouted")) });
  const formName = new Map(forms.map((x) => [x.id, x.name]));
  if (!q.data?.data.length) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title", { count: q.data.data.length })}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 text-sm">
          {q.data.data.map((u) => (
            <li key={u.id} className="border-border flex items-center justify-between gap-2 border-b py-2">
              <span>{u.form_ref ? formName.get(u.form_ref) : u.form_id}</span>
              <span className="text-muted text-xs">{f.relative(u.received_at, now || Date.now())}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function MetaCallback() {
  const t = useTranslations("meta.callback");
  const te = useTranslations("errors");
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const denied = params.get("error");
  const [error, setError] = useState<string | null>(denied ? t("denied") : null);
  const complete = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/integrations/meta/callback", { body: { code: code!, state: state! } })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("integration.meta.connected");
      const payload = { type: CALLBACK_MESSAGE, connectionId: r.connection.id, pages: r.available_pages };
      if (window.opener) {
        (window.opener as Window).postMessage(payload, window.location.origin);
        window.close();
      } else {
        sessionStorage.setItem("recov-meta-pages", JSON.stringify(payload));
        window.location.replace(window.location.pathname.replace(/\/callback$/, ""));
      }
    },
    onError: (e) => setError(isApiError(e) && te.has(e.code) ? te(e.code) : te("meta_oauth_failed")),
  });
  const { mutate, isIdle } = complete;
  useEffect(() => {
    if (code && state && isIdle) mutate();
  }, [code, state, isIdle, mutate]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? (
        <>
          <Link2Off className="text-danger size-10" aria-hidden />
          <p className="font-medium">{error}</p>
          <Button variant="secondary" onClick={() => (window.opener ? window.close() : history.back())}>
            {t("close")}
          </Button>
        </>
      ) : (
        <Spinner label={t("connecting")} />
      )}
    </main>
  );
}
