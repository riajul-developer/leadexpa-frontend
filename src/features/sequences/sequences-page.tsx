"use client";

import { Plus, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useClients } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useSequences } from "./api";
import { describeStep, describeTrigger } from "./describe";
import { RecoveredCard } from "./recovered-card";
import { SequenceStatusBadge } from "./status";

export function SequencesPage() {
  const t = useTranslations("sequences");
  const tl = useTranslations("lostReason");
  const ts = useTranslations("stage");
  const client = useActiveClient();
  const canManage = useCan("automation.manage");
  const { byId } = useClients();
  const q = useSequences(client ?? undefined);
  const rows = q.data?.data ?? [];
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/sequences/new">
              <Plus aria-hidden />
              {t("new")}
            </Link>
          </Button>
        )}
      </div>
      <RecoveredCard client={client ?? undefined} />
      {q.isPending ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Repeat} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="grid gap-3" aria-label={t("listLabel")}>
          {rows.map((s) => (
            <li key={s.id}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="grid gap-2 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/sequences/${s.id}`} className="flex-1 font-semibold hover:underline">
                      {s.name}
                    </Link>
                    <SequenceStatusBadge status={s.status} />
                  </div>
                  <p className="text-muted text-sm">
                    {describeTrigger(
                      t,
                      s.trigger,
                      (r) => tl(r),
                      (x) => ts(x),
                    )}
                    {" · "}
                    {s.client_id ? (byId.get(s.client_id)?.name ?? "—") : t("allClients")}
                  </p>
                  <ol className="text-muted flex flex-wrap items-center gap-1 text-xs">
                    {s.steps.map((st, i) => (
                      <li key={i} className="bg-surface-2 rounded-full px-2 py-0.5">
                        {describeStep(t, st)}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
