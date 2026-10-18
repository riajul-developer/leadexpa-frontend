"use client";

import { ArrowLeft, Pause, Play } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useSequence, useSequenceReport, useSetSequenceStatus, type Report } from "./api";
import { describeStep } from "./describe";
import { RecoveredView } from "./recovered-card";
import { SequenceEditor } from "./sequence-editor";
import { SequenceStatusBadge } from "./status";

export function SequenceDetail({ id }: { id: string }) {
  const t = useTranslations("sequences");
  const client = useActiveClient();
  const params = useSearchParams();
  const router = useRouter();
  const canManage = useCan("automation.manage");
  const isNew = id === "new";
  const q = useSequence(isNew ? null : id);
  const tab = params.get("tab") === "edit" || isNew ? "edit" : "monitor";

  if (isNew) {
    return (
      <Shell title={t("new")}>
        <SequenceEditor defaultClient={client ?? undefined} />
      </Shell>
    );
  }
  if (q.isPending) return <Skeleton className="m-4 h-64" />;
  if (!q.data) return <EmptyState title={t("notFound")} />;
  const s = q.data;
  return (
    <Shell
      title={s.name}
      badge={<SequenceStatusBadge status={s.status} />}
      actions={canManage && <StatusActions id={s.id} status={s.status} />}
    >
      {canManage && (
        <div className="flex gap-1" role="tablist" aria-label={t("views")}>
          {(["monitor", "edit"] as const).map((x) => (
            <Button
              key={x}
              size="sm"
              role="tab"
              aria-selected={tab === x}
              variant={tab === x ? "primary" : "secondary"}
              onClick={() => router.replace(`/sequences/${s.id}${x === "edit" ? "?tab=edit" : ""}`)}
            >
              {t(`tab.${x}`)}
            </Button>
          ))}
        </div>
      )}
      <div role="tabpanel" aria-label={t(`tab.${tab}`)}>
        {tab === "edit" && canManage ? <SequenceEditor key={s.version} sequence={s} /> : <Monitor id={s.id} />}
      </div>
    </Shell>
  );
}

function Shell({
  title,
  badge,
  actions,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("sequences");
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="hover:text-primary h-8 w-auto px-0 hover:bg-transparent active:bg-transparent"
        >
          <Link href="/sequences" aria-label={t("back")}>
            <ArrowLeft aria-hidden className="rtl:rotate-180" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
        {badge}
        {actions}
      </div>
      {children}
    </div>
  );
}

function StatusActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("sequences");
  const te = useTranslations("errors");
  const set = useSetSequenceStatus(id);
  const go = (s: "active" | "paused" | "archived") =>
    set.mutate(s, {
      onSuccess: () => toast.success(t(`statusToast.${s}`)),
      onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
    });
  return (
    <div className="flex gap-2">
      {status === "active" ? (
        <Button size="sm" variant="secondary" onClick={() => go("paused")} loading={set.isPending}>
          <Pause aria-hidden />
          {t("action.pause")}
        </Button>
      ) : status !== "archived" ? (
        <Button size="sm" onClick={() => go("active")} loading={set.isPending}>
          <Play aria-hidden />
          {t("action.activate")}
        </Button>
      ) : null}
      {status !== "archived" && (
        <Button size="sm" variant="ghost" onClick={() => go("archived")}>
          {t("action.archive")}
        </Button>
      )}
    </div>
  );
}

function Monitor({ id }: { id: string }) {
  const t = useTranslations("sequences");
  const f = useFormat();
  const q = useSequenceReport(id);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const r: Report = q.data;
  const total = r.enrolled.active + r.enrolled.completed + r.enrolled.exited;
  return (
    <div className="grid gap-4">
      <RecoveredView r={r.recovered} />
      <div className="grid gap-3 sm:grid-cols-4">
        {(["active", "completed", "exited", "holdout"] as const).map((k) => (
          <Card key={k}>
            <CardContent className="pt-4">
              <p className="text-muted text-sm">{t(`enrolled.${k}`)}</p>
              <p className="text-2xl font-semibold tabular-nums">{f.number(r.enrolled[k])}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {Object.keys(r.exits).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t("exitsLabel")}</span>
          {Object.entries(r.exits).map(([k, n]) => (
            <Badge key={k} tone={k === "opt_out" ? "warning" : k === "sale" || k === "reply" ? "success" : "neutral"}>
              {t(`exitReason.${k}`)} · {f.number(n)}
            </Badge>
          ))}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("funnel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {r.steps.map((st, i) => {
              const ran = st.done + st.skipped + st.failed;
              const share = total ? st.done / total : 0;
              const step = r.sequence.steps[i];
              return (
                <li key={i} className="grid gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted w-5 tabular-nums">{i + 1}</span>
                    <span className="flex-1">{step ? describeStep(t, step) : st.type}</span>
                    {st.type !== "wait" && (
                      <span className="text-muted tabular-nums">
                        {t("stepCounts", { done: st.done, skipped: st.skipped, failed: st.failed })}
                      </span>
                    )}
                  </div>
                  {st.type !== "wait" && (
                    <div
                      className="bg-surface-2 ms-7 h-2 overflow-hidden rounded-full"
                      role="img"
                      aria-label={t("stepBar", { done: st.done, total })}
                    >
                      <div className="bg-primary h-full" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                  )}
                  {ran > 0 && st.reasons.length > 0 && (
                    <p className="text-muted ms-7 text-xs">
                      {st.reasons
                        .map((x) => `${t.has(`reason.${x.reason}`) ? t(`reason.${x.reason}`) : x.reason} (${x.count})`)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("recent")}</CardTitle>
        </CardHeader>
        <CardContent>
          {r.recent.length === 0 ? (
            <p className="text-muted text-sm">{t("noEnrollments")}</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {r.recent.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/leads/${e.lead_id}`} className="flex-1 hover:underline">
                    {e.lead_name || "—"}
                  </Link>
                  <Badge tone={e.status === "active" ? "primary" : "neutral"}>
                    {e.exit_reason ? t(`exitReason.${e.exit_reason}`) : t(`enrolled.${e.status}`)}
                  </Badge>
                  <span className="text-muted text-xs">{f.relative(e.enrolled_at, Date.now())}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
