"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, Table2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { VoiceNumbers } from "@/features/calls";
import { ChannelsTab } from "@/features/conversations";
import { ClientReports } from "@/features/reports";
import { SlaPolicyEditor, CalendarEditor } from "@/features/sla";
import { SourcesPanel } from "@/features/sources";
import { Link } from "@/i18n/navigation";
import { api, unwrap } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { clientKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Badge, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { CLIENT_TABS, type ClientTab } from "../tabs";

import { AdoptionCard } from "./adoption-card";
import { AiProfileTab, CampaignsTab, ClientSettings, TeamTab } from "./client-tabs";
import { RoutingLog } from "./routing";

// Conversion feedback and spend sync load only on their tabs (the client page is close to its JS budget).
const ClientPayments = dynamic(() => import("@/features/paylinks").then((m) => m.ClientPayments));
const AgentSettings = dynamic(() => import("@/features/agent").then((m) => m.AgentSettings));
const ClientBusinessReviews = dynamic(() => import("@/features/revintel").then((m) => m.ClientBusinessReviews));
const ClientOfflineSales = dynamic(() => import("@/features/revintel").then((m) => m.ClientOfflineSales));
const BookingSettings = dynamic(() => import("@/features/appointments").then((m) => m.BookingSettings));
const ClientHealth = dynamic(() => import("@/features/insights").then((m) => m.ClientHealth));
const ConversionsTab = dynamic(() => import("@/features/conversions").then((m) => m.ConversionsTab));
const AdAccountsCard = dynamic(() => import("@/features/conversions").then((m) => m.AdAccountsCard));

export function ClientDetail({ clientId, tab }: { clientId: string; tab: ClientTab }) {
  const t = useTranslations("clients");
  const canReports = useCan("report.share");
  const canIntegrate = useCan("integration.manage");
  const q = useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}", { params: { path: { clientId } } })),
  });
  if (q.isPending)
    return (
      <div className="p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!q.data) return <EmptyState icon={Building2} title={t("notFound")} />;
  const c = q.data;
  const tabs = CLIENT_TABS.filter((x) => (x !== "reports" || canReports) && (x !== "conversions" || canIntegrate));
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{c.name}</h1>
          <p className="text-muted text-sm">
            {t(`industry.${c.industry || "other"}`)} · {c.timezone} · {c.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {c.status === "archived" && <Badge tone="warning">{t("archivedBadge")}</Badge>}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/leads?client=${c.id}`}>
              <Table2 aria-hidden />
              {t("viewLeads")}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/dashboard?client=${c.id}`}>
              <BarChart3 aria-hidden />
              {t("viewDashboard")}
            </Link>
          </Button>
        </div>
      </div>
      <nav aria-label={t("tabsLabel")} className="border-border flex gap-1 overflow-x-auto border-b">
        {tabs.map((x) => (
          <Link
            key={x}
            href={x === "overview" ? `/clients/${c.id}` : `/clients/${c.id}/${x}`}
            aria-current={tab === x ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              tab === x ? "border-primary text-text" : "text-muted hover:text-text border-transparent",
            )}
          >
            {t(`tabs.${x}`)}
          </Link>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <AdoptionCard clientId={c.id} />
          <ClientSettings client={c} />
        </>
      )}
      {tab === "health" && <ClientHealth clientId={c.id} clientName={c.name} currency={c.currency} />}
      {tab === "sources" && <SourcesPanel clientId={c.id} />}
      {tab === "channels" && (
        <div className="grid gap-4">
          <ChannelsTab clientId={c.id} />
          <VoiceNumbers clientId={c.id} />
        </div>
      )}
      {tab === "sla" && (
        <>
          <SlaPolicyEditor clientId={c.id} timeZone={c.timezone} />
          <CalendarEditor clientId={c.id} />
        </>
      )}
      {tab === "team" && (
        <div className="grid gap-4">
          <TeamTab clientId={c.id} smart={c.assignment_strategy === "smart"} />
          {c.assignment_strategy !== "manual" && <RoutingLog clientId={c.id} />}
        </div>
      )}
      {tab === "campaigns" && (
        <div className="grid gap-4">
          {canIntegrate && <AdAccountsCard clientId={c.id} currency={c.currency} />}
          <CampaignsTab clientId={c.id} />
        </div>
      )}
      {tab === "conversions" && canIntegrate && <ConversionsTab clientId={c.id} />}
      {tab === "payments" && <ClientPayments clientId={c.id} />}
      {tab === "reports" && <ClientReports clientId={c.id} />}
      {tab === "ai" && <AiProfileTab clientId={c.id} />}
      {tab === "agent" && <AgentSettings clientId={c.id} />}
      {tab === "booking" && <BookingSettings clientId={c.id} />}
      {tab === "offline" && <ClientOfflineSales clientId={c.id} timeZone={c.timezone} />}
      {tab === "reviews" && <ClientBusinessReviews clientId={c.id} />}
    </div>
  );
}
