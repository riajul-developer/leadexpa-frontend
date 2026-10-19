"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import type { Schemas } from "@/shared/lib/api/client";
import { usePreferences } from "@/shared/lib/preferences";
import {
  conversationKeys,
  importKeys,
  inboxKeys,
  leadKeys,
  metaKeys,
  notificationKeys,
  pipelineKeys,
} from "@/shared/lib/query-keys";
import { realtime, type StreamEvent } from "@/shared/lib/realtime";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";

type Lead = Schemas["Lead"];
type Notification = Schemas["Notification"];
type NotificationPage = { data: Notification[]; next_cursor: string | null; unread_count?: number };

function makeDebouncedInvalidate(qc: QueryClient, wait = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Set<string>();
  const keys: Record<string, readonly unknown[]> = {
    inbox: inboxKeys.all,
    leads: leadKeys.lists(),
    pipeline: pipelineKeys.all,
    notifications: notificationKeys.all,
    conversations: conversationKeys.all,
    // Literal keys: importing features here would pull them into every page.
    connectors: ["connectors"],
    conversions: ["conversions"],
  };
  return (name: keyof typeof keys) => {
    pending.add(name);
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      for (const n of pending) void qc.invalidateQueries({ queryKey: keys[n] });
      pending.clear();
    }, wait);
  };
}

export function applyEvent(
  qc: QueryClient,
  e: StreamEvent,
  invalidate: (
    n: "inbox" | "leads" | "pipeline" | "notifications" | "conversations" | "connectors" | "conversions",
  ) => void,
) {
  const d = e.data;
  const leadId = typeof d.lead_id === "string" ? d.lead_id : undefined;
  switch (e.type) {
    case "lead.created":
    case "lead.updated":
    case "lead.assigned": {
      if (leadId) {
        const cached = qc.getQueryData<Lead>(leadKeys.detail(leadId));
        const version = typeof d.version === "number" ? d.version : undefined;
        // Only refetch older versions; our own optimistic writes already match.
        if (cached && (version === undefined || cached.version < version)) {
          void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId), exact: true });
        }
      }
      invalidate("inbox");
      invalidate("leads");
      invalidate("pipeline");
      break;
    }
    case "activity.created":
      if (leadId) void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
      break;
    case "sla.warning":
    case "sla.breached":
    case "sla.escalated":
      if (leadId) void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId), exact: true });
      invalidate("inbox");
      break;
    case "notification.created": {
      const n = d as unknown as Notification;
      for (const unreadOnly of [false, true]) {
        qc.setQueryData<NotificationPage>(notificationKeys.list(unreadOnly), (old) =>
          old && !old.data.some((x) => x.id === n.id)
            ? { ...old, data: [n, ...old.data], unread_count: (old.unread_count ?? 0) + 1 }
            : old,
        );
      }
      break;
    }
    case "import.progress": {
      const id = typeof d.id === "string" ? d.id : typeof d.import_id === "string" ? d.import_id : undefined;
      if (id)
        qc.setQueryData(importKeys.detail(id), (old: Record<string, unknown> | undefined) =>
          old ? { ...old, ...d } : old,
        );
      if (id && (d.status === "completed" || d.status === "validated" || d.status === "failed")) {
        void qc.invalidateQueries({ queryKey: importKeys.detail(id) });
      }
      break;
    }
    case "integration.health_changed":
      void qc.invalidateQueries({ queryKey: metaKeys.overview });
      break;
    case "connector.health_changed":
      invalidate("connectors");
      break;
    case "conversion.destination_health_changed":
      invalidate("conversions");
      break;
    case "message.created":
    case "message.updated":
    case "conversation.claimed": {
      const conversationId = typeof d.conversation_id === "string" ? d.conversation_id : undefined;
      if (conversationId) {
        void qc.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
        void qc.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      }
      if (leadId && e.type === "message.created") void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
      invalidate("conversations");
      break;
    }
    case "payment.paid":
      if (leadId) {
        void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId) });
        void qc.invalidateQueries({ queryKey: leadKeys.sales(leadId) });
        void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) });
      }
      void qc.invalidateQueries({ queryKey: ["paylinks"] });
      invalidate("leads");
      invalidate("pipeline");
      break;
    case "agent.handoff":
    case "agent.draft":
      void qc.invalidateQueries({ queryKey: ["agent"] });
      break;
    case "reseller.sale":
      void qc.invalidateQueries({ queryKey: ["reseller"] });
      break;
  }
}

export function RealtimeBridge() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const t = useTranslations("sla.alert");
  const tp = useTranslations("payments");
  const fmt = useFormat();
  const router = useRouter();
  const sound = usePreferences((s) => s.slaSound);
  const meId = me?.user.id;
  const ctx = useRef({ meId, sound, t, tp, fmt, router });
  ctx.current = { meId, sound, t, tp, fmt, router };

  useEffect(() => {
    if (!meId) return;
    const invalidate = makeDebouncedInvalidate(qc);
    realtime.start();
    const off = realtime.subscribe((e) => {
      applyEvent(qc, e, invalidate);
      const { meId: uid, sound: playSound, t: tt, tp: ttp, fmt, router: r } = ctx.current;
      if (e.type === "payment.paid") {
        const amount = fmt.money({
          amount_minor: Number(e.data.amount_minor ?? 0),
          currency: String(e.data.currency ?? ""),
        });
        const provider = e.data.provider === "bkash" ? "bKash" : "SSLCommerz";
        const leadId = String(e.data.lead_id ?? "");
        toast.success(ttp("receivedToast", { amount, provider }), {
          action: leadId ? { label: tt("open"), onClick: () => r.push(`/leads/${leadId}`) } : undefined,
        });
      }
      if (e.type === "reseller.sale") {
        const amount = fmt.money({
          amount_minor: Number(e.data.amount_minor ?? 0),
          currency: String(e.data.currency ?? ""),
        });
        toast.success(ttp("resellerSaleToast", { amount }), {
          action: { label: tt("open"), onClick: () => r.push("/reseller") },
        });
      }
      if ((e.type === "sla.warning" || e.type === "sla.breached") && e.data.owner_user_id === uid) {
        const name = String(e.data.lead_name || "—");
        const msg = tt(e.type === "sla.warning" ? "warning" : "breached", { lead: name });
        const leadId = String(e.data.lead_id ?? "");
        toast[e.type === "sla.warning" ? "warning" : "error"](msg, {
          action: leadId ? { label: tt("open"), onClick: () => r.push(`/leads/${leadId}`) } : undefined,
        });
        if (playSound) void new Audio("/sounds/alert.wav").play().catch(() => undefined);
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.visibilityState === "hidden"
        ) {
          new Notification(msg, { tag: `sla-${leadId}`, icon: "/icons/icon-192.png" });
        }
      }
    });
    const offResync = realtime.onResync(() => {
      void qc.invalidateQueries({ queryKey: inboxKeys.all });
      void qc.invalidateQueries({ queryKey: leadKeys.lists() });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    });
    return () => {
      off();
      offResync();
    };
  }, [meId, qc]);

  useEffect(() => () => realtime.stop(), []);
  return null;
}
