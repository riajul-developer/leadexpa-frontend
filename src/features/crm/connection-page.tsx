"use client";

import { ArrowLeft, Pause, Play, RefreshCw, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  CRM_FIELDS,
  type CrmConnectionDetail,
  type CrmFieldRule,
  type CrmFieldRules,
  type CrmStageMap,
  STAGES,
  useCrmConnection,
  useCrmLog,
  useCrmProviders,
  useCrmStatuses,
  useDisconnectCrm,
  useStartCrmConnect,
  useSyncCrmNow,
  useUpdateCrmConnection,
} from "./api";
import { HealthBadge, ProviderMark } from "./parts";

const DIRECTIONS = ["both", "push", "pull", "off"] as const;
const POLICIES = ["newest_wins", "crm_wins", "leadexpa_wins"] as const;

export function CrmConnectionPage({ id }: { id: string }) {
  const t = useTranslations("crm");
  const { data: c, isPending, isError } = useCrmConnection(id);
  if (isPending) return <Skeleton className="m-4 h-96" />;
  if (isError || !c) return <EmptyState title={t("notFound")} />;
  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4">
      <Link href="/integrations" className="text-muted hover:text-text flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("back")}
      </Link>
      <Header c={c} />
      <Numbers c={c} />
      <FieldRules c={c} />
      <StageMap c={c} />
      <SyncLog id={c.id} />
    </div>
  );
}

function Header({ c }: { c: CrmConnectionDetail }) {
  const t = useTranslations("crm");
  const router = useRouter();
  const { data: providers } = useCrmProviders();
  const { byId } = useClients();
  const f = useFormat();
  const now = useNow();
  const name = providers?.data.find((p) => p.key === c.provider)?.name ?? c.provider;
  const sync = useSyncCrmNow(c.id);
  const update = useUpdateCrmConnection(c.id);
  const disconnect = useDisconnectCrm();
  const reconnect = useStartCrmConnect();
  const last = [c.last_pull_at, c.last_push_at].filter(Boolean).sort().at(-1);
  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
      <CardContent className="grid gap-3 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <ProviderMark provider={c.provider} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">
              {t("pageTitle", { name, client: byId.get(c.client_id)?.name ?? "" })}
            </h1>
            <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
              <HealthBadge connection={c} />
              <span>{c.account_name || c.account_id}</span>
              {last && <span>· {t("lastSync", { when: f.relative(last, now || Date.now()) })}</span>}
            </p>
          </div>
        </div>
        {c.last_error && (
          <p className="bg-danger-soft text-danger rounded-lg p-3 text-sm" role="status">
            {c.last_error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {c.status === "expired" ? (
            <Button
              loading={reconnect.isPending}
              onClick={() =>
                reconnect.mutate(
                  { provider: c.provider, client_id: c.client_id },
                  { onSuccess: ({ url }) => window.location.assign(url) },
                )
              }
            >
              {t("reconnect")}
            </Button>
          ) : (
            <>
              <Button
                loading={sync.isPending}
                disabled={c.status !== "active"}
                onClick={() => sync.mutate(undefined, { onSuccess: () => toast.success(t("synced")) })}
              >
                <RefreshCw aria-hidden />
                {t("syncNow")}
              </Button>
              <Button
                variant="secondary"
                loading={update.isPending}
                onClick={() => update.mutate({ status: c.status === "active" ? "paused" : "active" })}
              >
                {c.status === "active" ? <Pause aria-hidden /> : <Play aria-hidden />}
                {c.status === "active" ? t("pause") : t("resume")}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            className="text-danger ms-auto"
            loading={disconnect.isPending}
            onClick={() =>
              window.confirm(t("disconnectConfirm", { name })) &&
              disconnect.mutate(c.id, { onSuccess: () => router.push("/integrations") })
            }
          >
            <Unplug aria-hidden />
            {t("disconnect")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Numbers({ c }: { c: CrmConnectionDetail }) {
  const t = useTranslations("crm.stats");
  const f = useFormat();
  const tiles: [string, number][] = [
    ["linked", c.stats.linked],
    ["queued", c.stats.queued],
    ["pushed", (c.stats.last_24h.created ?? 0) + (c.stats.last_24h.updated ?? 0)],
    ["conflicts", c.stats.last_24h.conflict ?? 0],
    ["failed", c.stats.last_24h.failed ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map(([k, n]) => (
        <Card key={k} className="p-3">
          <p className="text-muted text-xs">{t(k)}</p>
          <p className={`text-xl font-semibold tabular-nums ${k === "failed" && n > 0 ? "text-danger" : ""}`}>
            {f.number(n)}
          </p>
        </Card>
      ))}
    </div>
  );
}

function FieldRules({ c }: { c: CrmConnectionDetail }) {
  const t = useTranslations("crm.rules");
  const { data: providers } = useCrmProviders();
  const amount = providers?.data.find((p) => p.key === c.provider)?.amount_supported ?? false;
  const update = useUpdateCrmConnection(c.id);
  const [rules, setRules] = useState<CrmFieldRules>(c.fields);
  useEffect(() => setRules(c.fields), [c.fields]);
  const dirty = JSON.stringify(rules) !== JSON.stringify(c.fields);
  const set = (field: (typeof CRM_FIELDS)[number], patch: Partial<CrmFieldRule>) =>
    setRules((r) => ({ ...r, [field]: { ...(r[field] ?? { direction: "off", policy: "newest_wins" }), ...patch } }));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-start text-xs">
                <th className="py-2 text-start font-medium">{t("field")}</th>
                <th className="py-2 text-start font-medium">{t("direction")}</th>
                <th className="py-2 text-start font-medium">{t("policy")}</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {CRM_FIELDS.map((field) => {
                const rule = rules[field] ?? { direction: "off", policy: "newest_wins" };
                const unsupported = field === "deal_value" && !amount;
                return (
                  <tr key={field}>
                    <td className="py-2 pe-3 font-medium">{t(`fields.${field}`)}</td>
                    <td className="py-2 pe-3">
                      <NativeSelect
                        aria-label={t("directionFor", { field: t(`fields.${field}`) })}
                        value={rule.direction}
                        disabled={unsupported}
                        onChange={(e) => set(field, { direction: e.target.value as CrmFieldRule["direction"] })}
                      >
                        {DIRECTIONS.map((d) => (
                          <option key={d} value={d}>
                            {t(`directions.${d}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="py-2">
                      {unsupported ? (
                        <span className="text-muted text-xs">{t("unsupported")}</span>
                      ) : (
                        <NativeSelect
                          aria-label={t("policyFor", { field: t(`fields.${field}`) })}
                          value={rule.policy}
                          disabled={rule.direction !== "both"}
                          onChange={(e) => set(field, { policy: e.target.value as CrmFieldRule["policy"] })}
                        >
                          {POLICIES.map((p) => (
                            <option key={p} value={p}>
                              {t(`policies.${p}`)}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted text-xs">{t("policyHint")}</p>
        <div className="flex justify-end">
          <Button
            disabled={!dirty}
            loading={update.isPending}
            onClick={() => update.mutate({ fields: rules }, { onSuccess: () => toast.success(t("saved")) })}
          >
            {t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StageMap({ c }: { c: CrmConnectionDetail }) {
  const t = useTranslations("crm.stages");
  const ts = useTranslations("stage");
  const statuses = useCrmStatuses(c.id, c.status !== "expired");
  const update = useUpdateCrmConnection(c.id);
  const [map, setMap] = useState<CrmStageMap>(c.stage_map);
  useEffect(() => setMap(c.stage_map), [c.stage_map]);
  const dirty = JSON.stringify(map) !== JSON.stringify(c.stage_map);
  const options = statuses.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {statuses.isError && <p className="text-warning text-sm">{t("unavailable")}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {STAGES.map((st) => {
            const current = map[st] ?? "";
            const known = options.some((o) => o.value === current);
            return (
              <div key={st} className="grid gap-1 text-sm">
                <label htmlFor={`stage-map-${st}`} className="font-medium">
                  {ts(st)}
                </label>
                <NativeSelect
                  id={`stage-map-${st}`}
                  value={current}
                  onChange={(e) => setMap((m) => ({ ...m, [st]: e.target.value || undefined }))}
                >
                  <option value="">{t("dontSend")}</option>
                  {!known && current && <option value={current}>{current}</option>}
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!dirty}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { stage_map: Object.fromEntries(Object.entries(map).filter(([, v]) => v)) as CrmStageMap },
                { onSuccess: () => toast.success(t("saved")) },
              )
            }
          >
            {t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncLog({ id }: { id: string }) {
  const t = useTranslations("crm.log");
  const tf = useTranslations("crm.rules.fields");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const { data, isPending } = useCrmLog(id);
  const rows = data?.data ?? [];
  const tone = (r: string) =>
    r === "failed"
      ? "danger"
      : r === "conflict"
        ? "warning"
        : r === "created" || r === "updated"
          ? "success"
          : "neutral";
  const field = (x: string) => (tf.has(x) ? tf(x) : x);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted py-6 text-center text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border grid divide-y text-sm">
            {rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Badge tone={e.direction === "push" ? "primary" : "info"}>{t(`direction.${e.direction}`)}</Badge>
                <Badge tone={tone(e.result)}>{t(`result.${e.result}`)}</Badge>
                <span className="min-w-0 flex-1">
                  {e.fields.map(field).join(", ")}
                  {e.conflicts &&
                    Object.entries(e.conflicts).map(([k, v]) => (
                      <span key={k} className="text-muted block text-xs">
                        {t("conflict", { field: field(k), winner: t(`winner.${v.winner}`) })}
                      </span>
                    ))}
                  {e.error && <span className="text-danger block text-xs">{e.error}</span>}
                </span>
                {e.lead_id && (
                  <Link
                    href={`/leads/${e.lead_id}`}
                    className="text-primary text-xs underline-offset-2 hover:underline"
                  >
                    {t("lead")}
                  </Link>
                )}
                <span className="text-muted text-xs tabular-nums">{f.dateTime(e.at, tz, "short")}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
