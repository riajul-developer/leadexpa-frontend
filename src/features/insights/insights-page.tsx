"use client";

import { Activity, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useClients } from "@/shared/lib/lookups";
import { NativeSelect } from "@/shared/ui/input";
import { Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useHealthOverview } from "./api";
import { AttributionPanel } from "./attribution-panel";
import { ForecastPanel } from "./forecast-panel";
import { HealthRing, TrendLine } from "./health-parts";

// Revenue intelligence (10.3) loads on its tabs.
const BenchmarksPanel = dynamic(() => import("@/features/revintel").then((m) => m.BenchmarksPanel));
const CalibrationCard = dynamic(() => import("@/features/revintel").then((m) => m.CalibrationCard));

/** /insights: client health across the agency, attribution and the pipeline forecast (17.10–17.11). */
export function InsightsPage() {
  const t = useTranslations("insights");
  const active = useActiveClient();
  const { clients } = useClients();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const clientId = picked ?? active ?? clients[0]?.id;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Activity className="text-accent size-6" aria-hidden />
            {t("title")}
          </h1>
          <p className="text-muted text-sm">{t("subtitle")}</p>
        </div>
      </header>
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">{t("tabs.health")}</TabsTrigger>
          <TabsTrigger value="attribution">{t("tabs.attribution")}</TabsTrigger>
          <TabsTrigger value="forecast">{t("tabs.forecast")}</TabsTrigger>
          <TabsTrigger value="benchmarks">{t("tabs.benchmarks")}</TabsTrigger>
        </TabsList>
        <TabsContent value="health" className="mt-4">
          <HealthOverview />
        </TabsContent>
        <TabsContent value="attribution" className="mt-4">
          <AttributionPanel clientId={active ?? undefined} />
        </TabsContent>
        <TabsContent value="forecast" className="mt-4 grid gap-4">
          <NativeSelect
            className="w-auto justify-self-start"
            aria-label={t("client")}
            value={clientId ?? ""}
            onChange={(e) => setPicked(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <ForecastPanel clientId={clientId} />
          <CalibrationCard clientId={clientId} />
        </TabsContent>
        <TabsContent value="benchmarks" className="mt-4 grid gap-4">
          <NativeSelect
            className="w-auto justify-self-start"
            aria-label={t("client")}
            value={clientId ?? ""}
            onChange={(e) => setPicked(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <BenchmarksPanel clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The three parts that weigh most in the score (25%, 20%, 20%), in a fixed order so the columns line up.
const KEY_COMPONENTS = ["volume", "speed", "conversion"] as const;

function keyComponents<C extends { key: string }>(all: C[]) {
  return KEY_COMPONENTS.flatMap((k) => all.filter((c) => c.key === k));
}

function deltaText(t: ReturnType<typeof useTranslations>, delta: number) {
  return t("delta", { delta: delta > 0 ? `+${delta}` : `${delta}` });
}

function HealthOverview() {
  const t = useTranslations("insights.overview");
  const th = useTranslations("insights.health");
  const q = useHealthOverview();
  if (!q.data) return <Skeleton className="h-64 w-full" />;
  if (q.data.data.length === 0) return <EmptyState title={t("empty")} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-border grid divide-y">
          {q.data.data.map((r) => (
            <li key={r.client_id} data-client={r.name}>
              <Link
                href={`/clients/${r.client_id}/health`}
                className="hover:bg-surface-2 flex items-center gap-3 rounded-lg px-2 py-3"
              >
                <HealthRing score={r.score} band={r.band} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-muted text-xs">
                    {r.band ? th(`band.${r.band}`) : th("noScore")}
                    {/* Phones: the week's change stays inline; bigger screens show it under the trend. */}
                    <span className="md:hidden">
                      {r.delta_7d != null && r.delta_7d !== 0 && ` · ${deltaText(t, r.delta_7d)}`}
                    </span>
                  </span>
                </span>
                {keyComponents(r.components).length > 0 && (
                  <ul className="hidden w-96 shrink-0 grid-cols-3 gap-x-4 lg:grid" aria-label={t("breakdown")}>
                    {keyComponents(r.components).map((c) => (
                      <li key={c.key} className="grid min-w-0 gap-1">
                        <span className="flex justify-between gap-1 text-xs">
                          <span className="text-muted truncate">{th(`component.${c.key}`)}</span>
                          <span className="tabular-nums">{c.score}</span>
                        </span>
                        <Progress
                          value={c.score}
                          className="h-1.5"
                          tone={c.score >= 70 ? "primary" : c.score >= 40 ? "warning" : "danger"}
                          label={th(`component.${c.key}`)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <span className="hidden w-32 shrink-0 gap-1 text-end text-xs md:grid">
                  {r.trend.length > 1 ? (
                    <TrendLine points={r.trend.map((p) => p.score)} label={t("trend")} className="h-8" />
                  ) : (
                    <span className="text-muted">{t("noTrend")}</span>
                  )}
                  {r.delta_7d != null && (
                    <span className={r.delta_7d > 0 ? "text-success" : r.delta_7d < 0 ? "text-danger" : "text-muted"}>
                      {r.delta_7d === 0 ? t("noChange") : deltaText(t, r.delta_7d)}
                    </span>
                  )}
                </span>
                {r.adverse_anomalies_7d > 0 && (
                  <Badge tone="danger">{t("issues", { count: r.adverse_anomalies_7d })}</Badge>
                )}
                <ChevronRight className="text-muted size-4 shrink-0 rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
