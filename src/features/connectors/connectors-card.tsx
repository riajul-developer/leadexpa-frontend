"use client";

import { ChevronRight, Plug, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { useClients } from "@/shared/lib/lookups";
import { useNow } from "@/shared/lib/sla";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useConnectorInstalls } from "./api";
import { HealthBadge } from "./parts";

const AddConnectorDialog = dynamic(() => import("./add-connector-dialog").then((m) => m.AddConnectorDialog));

export function ConnectorsCard({ clientId }: { clientId?: string }) {
  const t = useTranslations("connectors");
  const f = useFormat();
  const now = useNow();
  const { clients } = useClients();
  const q = useConnectorInstalls(clientId);
  const [adding, setAdding] = useState(false);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t("addConnector")}
        </Button>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !q.data?.data.length ? (
          <EmptyState icon={Plug} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <ul className="grid gap-2">
            {q.data.data.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/integrations/sources/${i.id}`}
                  className="border-border hover:border-primary flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-muted truncate text-xs">
                      {!clientId && `${clientName(i.client_id)} · `}
                      {i.last_success_at
                        ? t("lastLead", { when: f.relative(i.last_success_at, now || Date.now()) })
                        : t("noDeliveries")}
                    </p>
                  </div>
                  <HealthBadge install={i} />
                  <ChevronRight className="text-muted size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {adding && <AddConnectorDialog clientId={clientId} onClose={() => setAdding(false)} />}
    </Card>
  );
}
