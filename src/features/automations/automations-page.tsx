"use client";

import { Plus, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useClients } from "@/shared/lib/lookups";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useRules, useSetEnabled, type Rule } from "./api";
import { describeRule } from "./describe";

export function AutomationsPage() {
  const t = useTranslations("automations");
  const client = useActiveClient();
  const q = useRules(client ?? undefined);
  const rows = q.data?.data ?? [];
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        <Button asChild>
          <Link href="/automations/new">
            <Plus aria-hidden />
            {t("new")}
          </Link>
        </Button>
      </div>
      {q.isPending ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Zap} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="grid gap-3" aria-label={t("listLabel")}>
          {rows.map((r) => (
            <RuleCard key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleCard({ r }: { r: Rule }) {
  const t = useTranslations("automations");
  const { byId } = useClients();
  const toggle = useSetEnabled(r.id);
  const fired = (r.last_24h.fired ?? 0) + (r.last_24h.partial ?? 0);
  const failed = r.last_24h.failed ?? 0;
  return (
    <li>
      <Card>
        <CardContent className="grid gap-2 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/automations/${r.id}`} className="flex-1 font-semibold hover:underline">
              {r.name}
            </Link>
            <Switch
              checked={r.enabled}
              aria-label={t("enabledFor", { name: r.name })}
              disabled={toggle.isPending}
              onCheckedChange={(on) =>
                toggle.mutate(on, { onSuccess: () => toast.success(t(on ? "switchedOn" : "switchedOff")) })
              }
            />
          </div>
          <p className="text-muted text-sm">{describeRule(t, r)}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">{r.client_id ? (byId.get(r.client_id)?.name ?? "—") : t("allClients")}</span>
            <Badge tone="success">{t("stats.fired", { count: fired })}</Badge>
            {failed > 0 && <Badge tone="danger">{t("stats.failed", { count: failed })}</Badge>}
            {(r.last_24h.rate_limited ?? 0) > 0 && (
              <Badge tone="warning">{t("stats.limited", { count: r.last_24h.rate_limited ?? 0 })}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
