"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { type CrmConnection, crmKeys, useCrmConnections, useCrmProviders, useStartCrmConnect } from "./api";
import { CRM_CALLBACK_MESSAGE, HealthBadge, ProviderMark } from "./parts";

export function CrmCard({ clientId }: { clientId: string }) {
  const t = useTranslations("crm");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const providers = useCrmProviders();
  const conns = useCrmConnections(clientId);
  const connect = useStartCrmConnect();

  useEffect(() => {
    const onMessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.origin !== window.location.origin || e.data?.type !== CRM_CALLBACK_MESSAGE) return;
      toast.success(t("connected"));
      void qc.invalidateQueries({ queryKey: crmKeys.all });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc, t]);

  const start = (provider: CrmConnection["provider"]) =>
    connect.mutate(
      { provider, client_id: clientId },
      {
        onSuccess: ({ url }) => {
          const w = 560;
          const h = 720;
          const popup = window.open(
            url,
            "leadexpa-crm",
            `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`,
          );
          if (!popup) window.location.assign(url);
        },
        onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
      },
    );

  const byProvider = new Map((conns.data?.data ?? []).map((c) => [c.provider, c]));
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <ArrowLeftRight className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <p className="text-muted text-sm">{t("hint")}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {providers.isPending || conns.isPending ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(providers.data?.data ?? []).map((p) => {
              const c = byProvider.get(p.key);
              return (
                <li key={p.key} className="border-border flex items-center gap-3 rounded-lg border p-3">
                  <ProviderMark provider={p.key} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    {c ? (
                      <ConnectionLine connection={c} />
                    ) : (
                      <p className="text-muted text-xs">{p.configured ? t("notConnected") : t("unconfigured")}</p>
                    )}
                  </div>
                  {c ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/integrations/crm/${c.id}`} aria-label={t("open", { name: p.name })}>
                        {t("manage")}
                        <ChevronRight className="rtl:rotate-180" aria-hidden />
                      </Link>
                    </Button>
                  ) : (
                    p.configured && (
                      <Button
                        size="sm"
                        loading={connect.isPending && connect.variables?.provider === p.key}
                        onClick={() => start(p.key)}
                        aria-label={t("connectTo", { name: p.name })}
                      >
                        {t("connect")}
                      </Button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionLine({ connection: c }: { connection: CrmConnection }) {
  const t = useTranslations("crm");
  const f = useFormat();
  const now = useNow();
  const last = [c.last_pull_at, c.last_push_at].filter(Boolean).sort().at(-1);
  return (
    <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <HealthBadge connection={c} />
      <span className="truncate">{c.account_name || c.account_id}</span>
      {last && <span>· {t("lastSync", { when: f.relative(last, now || Date.now()) })}</span>}
    </p>
  );
}
