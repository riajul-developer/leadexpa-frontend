"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, ChevronRight, FileUp, Megaphone, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConnectorsCard } from "@/features/connectors";
import { GoogleAdsCard } from "@/features/conversions";
import { SourcesPanel } from "@/features/sources";
import { Link } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap, unwrapEmpty } from "@/shared/lib/api/client";
import { useClients } from "@/shared/lib/lookups";
import { metaKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

const CrmCard = dynamic(() => import("@/features/crm").then((m) => m.CrmCard), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full" />,
});

export function IntegrationsHub() {
  const t = useTranslations("integrations");
  const active = useActiveClient();
  const { clients } = useClients();
  const canIntegrate = useCan("integration.manage");
  const canImport = useCan("lead.import");
  const [picked, setPicked] = useState("");
  const clientId = active ?? (picked || clients.find((c) => c.status === "active")?.id);
  const meta = useQuery({
    queryKey: metaKeys.overview,
    queryFn: () => unwrap(api.GET("/v1/integrations/meta")),
    enabled: canIntegrate,
    meta: { silent: true },
  });
  const unhealthy =
    meta.data?.connections.filter((c) => c.status === "expired" || (c.status === "active" && c.health !== "healthy"))
      .length ?? 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {canIntegrate && (
          <Link href="/integrations/meta" className="block">
            <Card className="hover:border-primary flex items-center gap-3 p-4">
              <Megaphone className="text-primary size-6" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("meta")}</p>
                <p className="text-muted text-sm">
                  {!meta.data?.configured
                    ? t("metaUnconfigured")
                    : meta.data.connections.length === 0
                      ? t("metaNotConnected")
                      : t("metaPages", { count: meta.data.pages.filter((p) => p.status === "active").length })}
                </p>
              </div>
              {unhealthy > 0 && <Badge tone="danger">{t("needsAttention")}</Badge>}
              <ChevronRight className="text-muted size-4 rtl:-scale-x-100" aria-hidden />
            </Card>
          </Link>
        )}
        {canImport && (
          <Link href={clientId ? `/imports/new?client=${clientId}` : "/imports/new"} className="block">
            <Card className="hover:border-primary flex items-center gap-3 p-4">
              <FileUp className="text-primary size-6" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("csv")}</p>
                <p className="text-muted text-sm">{t("csvHint")}</p>
              </div>
              <ChevronRight className="text-muted size-4 rtl:-scale-x-100" aria-hidden />
            </Card>
          </Link>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("sources")}</CardTitle>
          {!active && (
            <Field label={t("client")} className="w-60">
              <NativeSelect value={clientId ?? ""} onChange={(e) => setPicked(e.target.value)}>
                {clients
                  .filter((c) => c.status === "active")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
        </CardHeader>
        <CardContent>
          {clientId ? <SourcesPanel clientId={clientId} /> : <EmptyState title={t("noClients")} />}
        </CardContent>
      </Card>
      {canIntegrate && <ConnectorsCard clientId={active ?? undefined} />}
      {canIntegrate && clientId && <CrmCard clientId={clientId} />}
      {canIntegrate && <GoogleAdsCard />}
      {canIntegrate && <IngestionIssues />}
    </div>
  );
}

function IngestionIssues() {
  const t = useTranslations("integrations.issues");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ingestion", "issues"], queryFn: () => unwrap(api.GET("/v1/ingestion/issues")) });
  const retry = useMutation({
    mutationFn: (eventId: string) =>
      unwrapEmpty(api.POST("/v1/ingestion/issues/{eventId}/retry", { params: { path: { eventId } } })),
    onSuccess: () => {
      toast.success(t("retrying"));
      void qc.invalidateQueries({ queryKey: ["ingestion", "issues"] });
    },
  });
  if (!q.data?.data.length) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="text-danger size-4" aria-hidden />
            {t("title", { count: q.data.data.length })}
          </CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 text-sm">
          {q.data.data.map((i) => (
            <li key={i.id} className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <Badge tone={i.status === "dead" ? "danger" : "warning"}>{t(`status.${i.status}`)}</Badge>
              <span className="text-muted min-w-0 flex-1 truncate">{i.last_error ?? "—"}</span>
              <span className="text-muted text-xs">
                {t("attempts", { n: i.attempts })} · {f.relative(i.received_at, now || Date.now())}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => retry.mutate(i.id)}
                loading={retry.isPending && retry.variables === i.id}
              >
                <RotateCcw aria-hidden />
                {t("retry")}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
