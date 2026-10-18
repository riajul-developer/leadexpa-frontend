"use client";

import {
  Banknote,
  Copy,
  History,
  Info,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { AiPanel } from "@/features/assistant";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useClients, useMembers } from "@/shared/lib/lookups";
import { useAgencyCurrency, useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan, useFlag } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { QualityBadge, StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/overlays";
import { Badge, EmptyState, Skeleton } from "@/shared/ui/primitives";
import { SlaChip } from "@/shared/ui/sla-chip";

import {
  useAssign,
  useChangeStage,
  useLead,
  useLogActivity,
  type LeadDetail as LeadDetailT,
  type Stage,
} from "../api/hooks";

import { useContactPolicy } from "./consent-panel";
import { contactHref, onContactClick, useContactFlow } from "./contact-flow";
import { InfoPanel, SalesPanel, SlaPanel } from "./panels";
import { ScoreWhy } from "./score-why";
import { StageDialog } from "./stage-dialog";
import { NEXT_STAGES, needsDialog } from "./stages";
import { Composer, Timeline } from "./timeline";

// Click-to-call (17.8) loads after first paint, only on the lead page (calls imports leads, so never statically).
const ClickToCall = dynamic(() => import("@/features/calls").then((m) => m.ClickToCall), { ssr: false });
// The lead's recovery sequence (17.3), loaded the same way.
// Payment links (17.0.2) load with the Sales tab: most lead views never open it.
const LeadPayments = dynamic(() => import("@/features/paylinks").then((m) => m.LeadPayments), { ssr: false });
const LeadPrediction = dynamic(() => import("@/features/revintel").then((m) => m.LeadPrediction), { ssr: false });
const LeadAppointments = dynamic(() => import("@/features/appointments").then((m) => m.LeadAppointments), {
  ssr: false,
});
// Presence (8h): teammates on this lead, loaded after first paint.
const LeadPresence = dynamic(() => import("@/features/presence").then((m) => m.LeadPresence), { ssr: false });
const SimulateReply = dynamic(() => import("@/features/sandbox").then((m) => m.SimulateReply), { ssr: false });
const EnrollmentCard = dynamic(() => import("@/features/sequences").then((m) => m.EnrollmentCard), { ssr: false });

export function LeadDetail({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const t = useTranslations("leadDetail");
  const lead = useLead(leadId);
  if (lead.isPending) {
    return (
      <div className="grid gap-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (lead.isError || !lead.data) {
    const notFound = isApiError(lead.error) && lead.error.status === 404;
    return <EmptyState icon={TriangleAlert} title={notFound ? t("notFound") : t("loadFailed")} />;
  }
  return <LeadDetailView lead={lead.data} compact={compact} />;
}

function LeadDetailView({ lead, compact }: { lead: LeadDetailT; compact: boolean }) {
  const t = useTranslations("leadDetail");
  const { byId } = useClients();
  const client = byId.get(lead.client_id);
  const displayTz = useDisplayTimeZone();
  const agencyCurrency = useAgencyCurrency();
  const timeZone = client?.timezone ?? displayTz;
  const currency = client?.currency ?? agencyCurrency;
  const conversationPane = useFlag("whatsapp_inbox");
  const [stageTo, setStageTo] = useState<Stage | null>(null);
  const [tab, setTab] = useState("timeline");
  const log = useLogActivity(lead);
  const showOutcome = useContactFlow((s) => s.showOutcome);

  const side = (
    <>
      <TabsContent value="info">
        <div className="p-4 pb-0 empty:hidden">
          <SimulateReply leadId={lead.id} hasPhone={!!lead.phone} />
        </div>
        <InfoPanel lead={lead} timeZone={timeZone} />
      </TabsContent>
      <TabsContent value="ai">
        <AiPanel
          lead={lead}
          onApplyStage={(s) => setStageTo(s)}
          onUseAsNote={(text) =>
            log.mutate({ type: "note", body: text }, { onSuccess: () => toast.success(t("noteSaved")) })
          }
        />
      </TabsContent>
      <TabsContent value="sales">
        <div className="grid gap-4 p-4 pb-0">
          <LeadPrediction lead={lead} timeZone={timeZone} />
          <LeadAppointments lead={lead} timeZone={timeZone} />
          <LeadPayments lead={lead} currency={currency} timeZone={timeZone} />
        </div>
        <SalesPanel lead={lead} currency={currency} timeZone={timeZone} />
      </TabsContent>
    </>
  );

  return (
    <div className="flex min-h-full flex-col">
      <Header lead={lead} timeZone={timeZone} onStage={setStageTo} compact={compact} />
      <Tabs value={tab} onValueChange={setTab} className={compact ? "flex-1" : "flex-1 lg:hidden"}>
        <TabsList className="bg-surface sticky top-0 z-10 px-2">
          <TabsTrigger value="timeline" className={TAB_TRIGGER}>
            <TabIcon tab="timeline" />
            {t("tabs.timeline")}
          </TabsTrigger>
          <TabsTrigger value="info" className={TAB_TRIGGER}>
            <TabIcon tab="info" />
            {t("tabs.info")}
          </TabsTrigger>
          <TabsTrigger value="ai" className={TAB_TRIGGER}>
            <TabIcon tab="ai" />
            {t("tabs.ai")}
          </TabsTrigger>
          <TabsTrigger value="sales" className={TAB_TRIGGER}>
            <TabIcon tab="sales" />
            {t("tabs.sales")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <Composer lead={lead} />
          <Timeline lead={lead} timeZone={timeZone} />
        </TabsContent>
        {side}
      </Tabs>

      {!compact && (
        <div
          className={`hidden flex-1 gap-0 lg:grid ${conversationPane ? "lg:grid-cols-[1fr_1fr_24rem]" : "lg:grid-cols-[1fr_26rem]"}`}
        >
          <section className="border-border min-w-0 border-e" aria-label={t("tabs.timeline")}>
            <Composer lead={lead} />
            <Timeline lead={lead} timeZone={timeZone} />
          </section>
          {/* Reserved: the WhatsApp conversation pane (Tier 1) slots in here without a redesign. */}
          {conversationPane && <section className="border-border min-w-0 border-e" aria-label={t("conversation")} />}
          <Tabs defaultValue="ai" className="min-w-0">
            <TabsList className="px-2">
              <TabsTrigger value="ai" className={TAB_TRIGGER}>
                <TabIcon tab="ai" />
                {t("tabs.ai")}
              </TabsTrigger>
              <TabsTrigger value="info" className={TAB_TRIGGER}>
                <TabIcon tab="info" />
                {t("tabs.info")}
              </TabsTrigger>
              <TabsTrigger value="sales" className={TAB_TRIGGER}>
                <TabIcon tab="sales" />
                {t("tabs.sales")}
              </TabsTrigger>
            </TabsList>
            {side}
          </Tabs>
        </div>
      )}

      {/* Sticky action bar on phones: Call · WhatsApp · Log */}
      {lead.phone && !lead.do_not_contact && (
        <div className="border-border bg-surface sticky bottom-0 z-10 flex gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button asChild className="flex-1" size="lg">
            <a href={contactHref(lead, "call")} onClick={() => onContactClick(lead, "call")}>
              <Phone aria-hidden />
              {t("call")}
            </a>
          </Button>
          <Button asChild variant="secondary" className="flex-1" size="lg">
            <a
              href={contactHref(lead, "whatsapp")}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onContactClick(lead, "whatsapp")}
            >
              <MessageCircle className="text-success" aria-hidden />
              {t("whatsapp")}
            </a>
          </Button>
          <Button variant="secondary" size="lg" onClick={() => showOutcome(lead, "call")} aria-label={t("log")}>
            <NotebookPen aria-hidden />
          </Button>
        </div>
      )}

      {stageTo &&
        (needsDialog(stageTo) ? (
          <StageDialog lead={lead} to={stageTo} currency={currency} onClose={() => setStageTo(null)} />
        ) : (
          <DirectStage lead={lead} to={stageTo} onDone={() => setStageTo(null)} />
        ))}
    </div>
  );
}

/** Moves that need no extra input apply immediately. */
function DirectStage({ lead, to, onDone }: { lead: LeadDetailT; to: Stage; onDone: () => void }) {
  const { mutate } = useChangeStage(lead);
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    mutate({ to }, { onSettled: onDone });
  }, [mutate, to, onDone]);
  return null;
}

function Header({
  lead,
  timeZone,
  onStage,
  compact,
}: {
  lead: LeadDetailT;
  timeZone: string;
  onStage: (s: Stage) => void;
  compact: boolean;
}) {
  const t = useTranslations("leadDetail");
  const ts = useTranslations("stage");
  const f = useFormat();
  const { byId } = useClients();
  const { members } = useMembers();
  const canAssign = useCan("lead.assign");
  const canUpdate = useCan("lead.update");
  const assign = useAssign(lead);
  const client = byId.get(lead.client_id);
  const owners = members.filter((m) => m.status === "active" && m.role !== "client_viewer");
  const copy = (v: string) => void navigator.clipboard.writeText(v).then(() => toast.success(t("copied")));

  return (
    <header className="border-border grid gap-3 border-b p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{lead.full_name || lead.phone?.display || t("unnamed")}</h1>
          <p className="text-muted text-sm">
            {client?.name}
            {lead.campaign ? ` · ${lead.campaign.name}` : ""} ·{" "}
            {t("received", { when: f.dateTime(lead.received_at, timeZone) })}
            {client && client.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && ` (${client.timezone})`}
          </p>
          <LeadPresence leadId={lead.id} />
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={lead.stage} />
          <QualityBadge quality={lead.quality} />
          <ScoreWhy lead={lead} />
          <SlaChip lead={lead} timeZone={timeZone} live />
          {/* Tags set by automation rules (17.5). */}
          {(lead.tags ?? []).map((tag) => (
            <Badge key={tag} tone="info">
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      {lead.do_not_contact && (
        <p role="note" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {t("doNotContact")}
        </p>
      )}
      {!lead.do_not_contact && <QuietHoursHint leadId={lead.id} />}
      {lead.duplicate_count > 0 && (
        <p role="note" className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm">
          {t("duplicateBanner", { count: lead.duplicate_count })}
        </p>
      )}

      {/* On the full page on big screens the sequence card and the contact row sit side by side. */}
      <div className={cn("grid gap-3", !compact && "xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-x-6")}>
        <EnrollmentCard lead={lead} />
        {/* Contact + owner and the stage moves share one row on big screens; they stack below lg. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {lead.phone && (
              <span className="border-border inline-flex items-center gap-1 rounded-lg border px-2 py-1">
                <a
                  href={contactHref(lead, "call")}
                  onClick={() => onContactClick(lead, "call")}
                  className="font-medium tabular-nums"
                >
                  {lead.phone.display}
                </a>
                <button
                  type="button"
                  className="text-muted hover:bg-surface-2 rounded p-1"
                  onClick={() => copy(lead.phone!.display)}
                  aria-label={t("copyPhone")}
                >
                  <Copy className="size-3.5" aria-hidden />
                </button>
              </span>
            )}
            {lead.phone && !lead.do_not_contact && <ClickToCall lead={lead} />}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="border-border inline-flex items-center gap-1 rounded-lg border px-2 py-1"
              >
                <Mail className="text-muted size-3.5" aria-hidden />
                {lead.email}
              </a>
            )}
            {canAssign ? (
              <label className="inline-flex items-center gap-2">
                <span className="text-muted">{t("owner")}</span>
                <NativeSelect
                  className="h-8 w-auto"
                  value={lead.owner_user_id ?? ""}
                  onChange={(e) => assign.mutate(e.target.value || null)}
                  aria-label={t("owner")}
                >
                  <option value="">{t("unassigned")}</option>
                  {owners.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : null}
          </div>

          {canUpdate && NEXT_STAGES[lead.stage].length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("moveTo")}>
              <span className="text-muted text-sm">{t("moveTo")}</span>
              {NEXT_STAGES[lead.stage].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "lost" ? "ghost" : s === "won" ? "success" : "secondary"}
                  onClick={() => onStage(s)}
                >
                  {ts(s)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      <details>
        <summary className="text-muted cursor-pointer text-sm">{t("slaHistory")}</summary>
        <div className="mt-2">
          <SlaPanel leadId={lead.id} timeZone={timeZone} />
        </div>
      </details>
    </header>
  );
}

/** The contact policy's heads-up for a person about to call: quiet hours in the lead's own time zone. */
function QuietHoursHint({ leadId }: { leadId: string }) {
  const t = useTranslations("leadDetail");
  const f = useFormat();
  const policy = useContactPolicy(leadId);
  const call = policy.data?.channels.call;
  if (!call || call.verdict !== "warn" || !call.reasons.includes("quiet_hours") || !call.defer_until) return null;
  return (
    <p role="note" className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm">
      {t("quietHours", {
        until: f.dateTime(call.defer_until, Intl.DateTimeFormat().resolvedOptions().timeZone, "short"),
      })}
    </p>
  );
}

const TAB_TRIGGER = "inline-flex items-center gap-1.5";
const TAB_ICONS: Record<"timeline" | "info" | "ai" | "sales", LucideIcon> = {
  timeline: History,
  info: Info,
  ai: Sparkles,
  sales: Banknote,
};

function TabIcon({ tab }: { tab: keyof typeof TAB_ICONS }) {
  const Icon = TAB_ICONS[tab];
  return <Icon className="size-4" aria-hidden />;
}
