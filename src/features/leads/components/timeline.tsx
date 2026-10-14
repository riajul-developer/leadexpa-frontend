"use client";

import {
  ArrowRightLeft,
  Bot,
  Camera,
  Copy,
  Mail,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Phone,
  Settings2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { useMembers } from "@/shared/lib/lookups";
import { Button } from "@/shared/ui/button";
import { Input, Textarea } from "@/shared/ui/input";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useActivities, useLogActivity, type Activity, type Lead, type Outcome } from "../api/hooks";

import { ConversationWindow } from "./conversation-window";

// ---------------------------------------------------------------------------------------------
// Renderer registry (FRONTEND_PROMPT §16): keyed by type, so new channels plug in without a rewrite.

interface ItemRenderer {
  icon: LucideIcon;
  tone?: string;
  /** Title line; body defaults to activity.body. */
  title: (a: Activity, t: ReturnType<typeof useTranslations>) => ReactNode;
}

// Automated messages: a recovery sequence, the appointment engine (confirmations, reminders) or the auto-responder.
const automatedTitle = (via?: string) =>
  via === "sequence" ? "sequenceMessage" : via === "appointments" ? "appointmentMessage" : "autoReply";

const REGISTRY: Record<string, ItemRenderer> = {
  call: {
    icon: Phone,
    title: (a, t) =>
      (a.meta as { via?: string }).via === "inbound_call"
        ? t("inboundCall")
        : t("call", { outcome: a.outcome ? t(`outcome.${a.outcome}`) : "" }),
  },
  whatsapp: {
    icon: MessageCircle,
    tone: "text-success",
    title: (a, t) =>
      (a.meta as { automated?: boolean }).automated
        ? t(automatedTitle((a.meta as { via?: string }).via))
        : t("whatsapp", { outcome: a.outcome ? t(`outcome.${a.outcome}`) : "" }),
  },
  sms: {
    icon: MessageSquare,
    title: (a, t) => {
      const via = (a.meta as { via?: string }).via;
      return via === "sequence" || via === "appointments" ? t(automatedTitle(via)) : t("sms");
    },
  },
  email: { icon: Mail, title: (_a, t) => t("email") },
  meeting: {
    icon: Users,
    title: (a, t) => {
      const m = a.meta as { via?: string; appointment_id?: string; event?: string };
      // Appointments (10.1): booked, rescheduled, confirmed, cancelled, attended, no-show.
      if (m.appointment_id && m.event && t.has(`appointment.${m.event}`)) return t(`appointment.${m.event}`);
      return m.via === "walk_in" ? t("walkIn") : t("meeting");
    },
  },
  note: { icon: NotebookPen, title: (_a, t) => t("note") },
  stage_change: {
    icon: ArrowRightLeft,
    tone: "text-primary",
    title: (a, t) => {
      const m = a.meta as { from?: string; to?: string };
      return t("stageChange", { from: m.from ? t(`stage.${m.from}`) : "—", to: m.to ? t(`stage.${m.to}`) : "—" });
    },
  },
  assignment: { icon: UserPlus, title: (_a, t) => t("assignment") },
  duplicate_submission: { icon: Copy, tone: "text-warning", title: (_a, t) => t("duplicate") },
  ai_draft_used: { icon: Bot, tone: "text-primary", title: (_a, t) => t("aiDraft") },
  system: {
    icon: Settings2,
    title: (a, t) => {
      // A recovery sequence handed the lead to a person (17.3).
      const m = a.meta as { via?: string; task?: string; sequence?: string; kind?: string; status?: string };
      // Payment links (17.0.2): requested → paid / failed / cancelled / expired / refunded.
      if (m.kind === "payment") return t(`payment.${m.status ?? "requested"}`);
      if (m.via === "automation") return t("automationTask", { rule: m.sequence ?? "" });
      if (m.via === "appointments") return t("appointmentCall", { title: m.sequence ?? "" });
      if (m.via !== "sequence") return t("system");
      return t(m.task === "draft" ? "sequenceDraft" : "sequenceCall", { sequence: m.sequence ?? "" });
    },
  },
  // Inbound DMs (17.0.4): the lead wrote to the page or the Instagram account.
  messenger: { icon: MessageCircle, tone: "text-primary", title: (_a, t) => t("messenger") },
  instagram: { icon: Camera, tone: "text-primary", title: (_a, t) => t("instagram") },
};

export function registerTimelineRenderer(type: string, r: ItemRenderer) {
  REGISTRY[type] = r;
}

function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

export function Timeline({ lead, timeZone }: { lead: Lead; timeZone: string }) {
  const t = useTranslations("timeline");
  const f = useFormat();
  const { byUserId } = useMembers();
  const q = useActivities(lead.id);
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  if (q.isPending) {
    return (
      <div className="grid gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <EmptyState icon={NotebookPen} title={t("empty")} />;

  let lastDay = "";
  return (
    <>
      <ConversationWindow lead={lead} activities={items} />
      <ol className="grid gap-0 px-4 py-2">
        {items.map((a) => {
          const r = REGISTRY[a.type] ?? REGISTRY.system!;
          const Icon = r.icon;
          const day = dayKey(a.occurred_at, timeZone);
          const header = day !== lastDay ? f.dateTime(a.occurred_at, timeZone, "date") : null;
          lastDay = day;
          const actor = a.actor_user_id ? byUserId.get(a.actor_user_id)?.user.name : null;
          return (
            <li key={a.id}>
              {header && (
                <h3 className="bg-surface text-muted sticky top-0 z-10 py-2 text-xs font-semibold">{header}</h3>
              )}
              <div className="flex gap-3 py-2">
                <span className="bg-surface-2 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Icon className={cn("size-3.5", r.tone ?? "text-muted")} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{r.title(a, t)}</span>
                    {actor && <span className="text-muted"> · {actor}</span>}
                  </p>
                  {a.body && <p className="text-muted mt-0.5 text-sm break-words whitespace-pre-wrap">{a.body}</p>}
                  <time className="text-muted text-xs" dateTime={a.occurred_at}>
                    {f.dateTime(a.occurred_at, timeZone, "time")}
                  </time>
                  {(a.meta as { call_id?: string }).call_id && (
                    <Link
                      href={`/calls?c=${(a.meta as { call_id: string }).call_id}`}
                      className="text-primary ms-2 text-xs hover:underline"
                    >
                      {t("openCall")}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {q.hasNextPage && (
          <li className="py-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
              {t("more")}
            </Button>
          </li>
        )}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

const COMPOSER_OUTCOMES: Outcome[] = [
  "connected",
  "no_answer",
  "busy",
  "callback_requested",
  "interested",
  "not_interested",
  "wrong_number",
];

/** Log a call / note / message with outcome chips; "Schedule callback" takes a date-time. */
export function Composer({ lead }: { lead: Lead }) {
  const t = useTranslations("composer");
  const to = useTranslations("outcome");
  const log = useLogActivity(lead);
  const [type, setType] = useState<"note" | "call" | "whatsapp" | "sms">("note");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [body, setBody] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const needsOutcome = type === "call";
  const needsCallback = outcome === "callback_requested";
  const valid =
    (type === "note" ? body.trim() !== "" : true) && (!needsOutcome || outcome) && (!needsCallback || callbackAt);

  const submit = () => {
    log.mutate(
      {
        type,
        outcome: type === "note" ? undefined : (outcome ?? (type === "call" ? undefined : "message_sent")),
        body: body.trim() || undefined,
        callback_at: needsCallback ? new Date(callbackAt).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          setBody("");
          setOutcome(null);
          setCallbackAt("");
        },
      },
    );
  };

  return (
    <div className="border-border grid gap-2 border-b p-4" data-lead-edit>
      <div className="flex gap-1" role="tablist" aria-label={t("type")}>
        {(["note", "call", "whatsapp", "sms"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={type === k}
            onClick={() => {
              setType(k);
              setOutcome(null);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              type === k ? "bg-primary-soft text-primary font-medium" : "text-muted hover:bg-surface-2",
            )}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {type !== "note" && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("outcome")}>
          {(type === "call" ? COMPOSER_OUTCOMES : (["message_sent", "callback_requested"] as Outcome[])).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={outcome === o}
              onClick={() => setOutcome(o)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                outcome === o
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-muted hover:bg-surface-2",
              )}
            >
              {to(o)}
            </button>
          ))}
        </div>
      )}
      {needsCallback && (
        <Input
          type="datetime-local"
          value={callbackAt}
          onChange={(e) => setCallbackAt(e.target.value)}
          aria-label={t("callbackAt")}
        />
      )}
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t(type === "note" ? "notePlaceholder" : "bodyPlaceholder")}
        aria-label={t("body")}
        maxLength={5000}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!valid} loading={log.isPending}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
