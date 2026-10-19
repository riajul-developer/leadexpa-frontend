"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { useMembers } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

const adoptionKey = (clientId: string) => ["clients", clientId, "adoption"] as const;

export function AdoptionCard({ clientId }: { clientId: string }) {
  const t = useTranslations("clients.adoption");
  const te = useTranslations("errors");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const canRead = useCan("report.read");
  const canRemind = useCan("lead.assign");
  const { byUserId } = useMembers();
  const q = useQuery({
    queryKey: adoptionKey(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/adoption", { params: { path: { clientId } } })),
    enabled: canRead,
  });
  const remind = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/clients/{clientId}/adoption/remind", { params: { path: { clientId } } })),
    meta: { silent: true },
    onSuccess: (r) => {
      track("client.adoption.reminded", { count: r.reminded });
      toast.success(t("reminded", { count: r.reminded }));
      void qc.invalidateQueries({ queryKey: adoptionKey(clientId) });
    },
    onError: (e) =>
      toast.error(isApiError(e) && e.code === "reminded_recently" ? t("remindedRecently") : te("internal")),
  });
  if (!canRead) return null;
  if (q.isPending) return <Skeleton className="h-32 w-full" />;
  const a = q.data;
  if (!a) return null;
  const idle = a.staff.filter((s) => !s.active);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-4" aria-hidden />
            {t("title")}
          </CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        {canRemind && idle.some((s) => s.has_phone) && (
          <Button size="sm" variant="secondary" onClick={() => remind.mutate()} loading={remind.isPending}>
            <BellRing aria-hidden />
            {t("remind")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {a.staff_total === 0 ? (
          <p className="text-muted text-sm">
            {t("noStaff")}{" "}
            <Link href="/settings/team" className="text-primary font-medium">
              {t("inviteStaff")}
            </Link>
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label={t("outcomeRate")}
                value={a.outcome_rate == null ? "—" : f.percent(a.outcome_rate)}
                sub={t("ofLeads", { done: a.with_outcome, total: a.assigned_leads })}
                tone={a.outcome_rate != null && a.outcome_rate < 0.5 ? "text-danger" : undefined}
              />
              <Stat
                label={t("medianDelay")}
                value={a.median_log_delay_seconds == null ? "—" : f.duration(a.median_log_delay_seconds)}
              />
              <Stat label={t("activeStaff")} value={t("ofStaff", { active: a.staff_active, total: a.staff_total })} />
            </dl>
            {idle.length > 0 && (
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">{t("idle")}</h3>
                <ul className="grid gap-1 text-sm">
                  {idle.map((s) => (
                    <li key={s.user_id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{byUserId.get(s.user_id)?.user.name ?? "—"}</span>
                      {s.waiting_leads > 0 && <Badge tone="warning">{t("waiting", { count: s.waiting_leads })}</Badge>}
                      <span className="text-muted text-xs">
                        {s.last_activity_at
                          ? t("lastActive", { when: f.relative(s.last_activity_at, now || Date.now()) })
                          : t("neverActive")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-muted text-xs">
              {t("actionLinks", { created: a.action_links.created, used: a.action_links.used })}
              {a.last_reminded_at &&
                ` · ${t("lastReminded", { when: f.relative(a.last_reminded_at, now || Date.now()) })}`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className={`text-xl font-semibold ${tone ?? ""}`}>{value}</dd>
      {sub && <dd className="text-muted text-xs">{sub}</dd>}
    </div>
  );
}
