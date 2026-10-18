"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { useMembers } from "@/shared/lib/lookups";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useDeleteRule, useRule, useRuns, useSetEnabled, useVersions, type Run } from "./api";
import { ruleLines } from "./describe";
import { Checks, RuleBuilder } from "./rule-builder";

const TABS = ["builder", "log", "history"] as const;
type Tab = (typeof TABS)[number];
const STATUS_TONE: Record<Run["status"], "success" | "danger" | "warning" | "neutral" | "primary"> = {
  fired: "success",
  partial: "warning",
  failed: "danger",
  no_match: "neutral",
  rate_limited: "warning",
  depth_limited: "warning",
  lead_gone: "neutral",
  running: "primary",
};

export function RuleDetail({ id }: { id: string }) {
  const t = useTranslations("automations");
  const client = useActiveClient();
  const params = useSearchParams();
  const router = useRouter();
  const isNew = id === "new";
  const q = useRule(isNew ? null : id);
  const tab: Tab = TABS.find((x) => x === params.get("tab")) ?? "builder";

  if (isNew)
    return (
      <Shell title={t("new")}>
        <RuleBuilder defaultClient={client ?? undefined} />
      </Shell>
    );
  if (q.isPending) return <Skeleton className="m-4 h-64" />;
  if (!q.data) return <EmptyState title={t("notFound")} />;
  const r = q.data;
  return (
    <Shell title={r.name} actions={<RuleActions id={r.id} enabled={r.enabled} name={r.name} />}>
      <div className="flex gap-1" role="tablist" aria-label={t("views")}>
        {TABS.map((x) => (
          <Button
            key={x}
            size="sm"
            role="tab"
            aria-selected={tab === x}
            variant={tab === x ? "primary" : "secondary"}
            onClick={() => router.replace(`/automations/${r.id}${x === "builder" ? "" : `?tab=${x}`}`)}
          >
            {t(`tab.${x}`)}
          </Button>
        ))}
      </div>
      <div role="tabpanel" aria-label={t(`tab.${tab}`)}>
        {tab === "builder" && <RuleBuilder key={r.version} rule={r} />}
        {tab === "log" && <RunLog id={r.id} />}
        {tab === "history" && <VersionHistory id={r.id} />}
      </div>
    </Shell>
  );
}

function Shell({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const t = useTranslations("automations");
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="hover:text-primary h-8 w-auto px-0 hover:bg-transparent active:bg-transparent"
        >
          <Link href="/automations" aria-label={t("back")}>
            <ArrowLeft aria-hidden className="rtl:rotate-180" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  );
}

function RuleActions({ id, enabled, name }: { id: string; enabled: boolean; name: string }) {
  const t = useTranslations("automations");
  const router = useRouter();
  const toggle = useSetEnabled(id);
  const del = useDeleteRule(id);
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={enabled}
          aria-label={t("enabledFor", { name })}
          disabled={toggle.isPending}
          onCheckedChange={(on) =>
            toggle.mutate(on, { onSuccess: () => toast.success(t(on ? "switchedOn" : "switchedOff")) })
          }
        />
        {t(enabled ? "on" : "off")}
      </label>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t("delete")}
        loading={del.isPending}
        onClick={() => {
          if (window.confirm(t("deleteConfirm")))
            del.mutate(undefined, {
              onSuccess: () => {
                toast.success(t("deleted"));
                router.replace("/automations");
              },
            });
        }}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function RunLog({ id }: { id: string }) {
  const t = useTranslations("automations");
  const f = useFormat();
  const [status, setStatus] = useState<Run["status"] | "">("");
  const q = useRuns(id, status || undefined);
  const runs = q.data?.pages.flatMap((p) => p.data) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <p className="text-muted flex-1 text-sm">{t("log.hint")}</p>
        <NativeSelect
          aria-label={t("log.filter")}
          className="w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value as Run["status"] | "")}
        >
          <option value="">{t("log.all")}</option>
          {(Object.keys(STATUS_TONE) as Run["status"][]).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {q.isPending ? (
        <Skeleton className="h-32" />
      ) : runs.length === 0 ? (
        <EmptyState title={t("log.empty")} />
      ) : (
        <ul className="grid gap-2" aria-label={t("tab.log")}>
          {runs.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="grid gap-2 pt-3">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-2 text-start text-sm"
                    aria-expanded={open === r.id}
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                  >
                    <Badge tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Badge>
                    <span className="flex-1 font-medium">{r.lead_name || "—"}</span>
                    {r.depth > 0 && <span className="text-muted text-xs">{t("log.chained", { depth: r.depth })}</span>}
                    <span className="text-muted text-xs">
                      v{r.rule_version} · {f.relative(r.created_at, Date.now())}
                    </span>
                  </button>
                  {open === r.id && (
                    <div className="border-border grid gap-3 border-t pt-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase">{t("log.why")}</p>
                        <Checks checks={r.explain} />
                      </div>
                      {r.results.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase">{t("log.did")}</p>
                          <ul className="grid gap-1 text-sm">
                            {r.results.map((x, i) => (
                              <li key={i}>
                                {t(`action.${x.type}`)} —{" "}
                                <span className={cn(x.status === "failed" && "text-danger")}>
                                  {t(`result.${x.status}`)}
                                </span>
                                {x.detail && <span className="text-muted"> ({x.detail})</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.lead_id && (
                        <Link href={`/leads/${r.lead_id}`} className="text-primary text-sm hover:underline">
                          {t("log.openLead")}
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
          {q.hasNextPage && (
            <li className="text-center">
              <Button size="sm" variant="ghost" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
                {t("more")}
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function VersionHistory({ id }: { id: string }) {
  const t = useTranslations("automations");
  const f = useFormat();
  const { byUserId } = useMembers();
  const q = useVersions(id);
  const versions = q.data?.data ?? [];
  const [pick, setPick] = useState<number | null>(null);
  if (q.isPending) return <Skeleton className="h-32" />;
  const selected = versions.find((v) => v.version === pick) ?? versions[0];
  const prev = selected && versions.find((v) => v.version === selected.version - 1);
  const now = selected ? ruleLines(t, selected.definition) : [];
  const before = prev ? ruleLines(t, prev.definition) : [];
  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <ul className="grid content-start gap-1" aria-label={t("tab.history")}>
        {versions.map((v) => (
          <li key={v.version}>
            <button
              type="button"
              aria-current={selected?.version === v.version ? "true" : undefined}
              onClick={() => setPick(v.version)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-start text-sm",
                selected?.version === v.version ? "bg-primary-soft text-primary" : "hover:bg-surface-2",
              )}
            >
              <span className="font-medium">v{v.version}</span>
              <span className="text-muted block text-xs">
                {(v.created_by && byUserId.get(v.created_by)?.user.name) || "—"} ·{" "}
                {f.relative(v.created_at, Date.now())}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted mb-2 text-sm">
              {prev ? t("history.diff", { from: prev.version, to: selected.version }) : t("history.first")}
            </p>
            <pre className="overflow-x-auto font-mono text-xs leading-6" aria-label={t("history.changes")}>
              {before
                .filter((l) => !now.includes(l))
                .map((l, i) => (
                  <div key={`-${i}`} className="bg-danger-soft text-danger">
                    − {l}
                  </div>
                ))}
              {now.map((l, i) => (
                <div key={i} className={cn(prev && !before.includes(l) && "bg-success-soft text-success")}>
                  {prev && !before.includes(l) ? "+ " : "  "}
                  {l}
                </div>
              ))}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
