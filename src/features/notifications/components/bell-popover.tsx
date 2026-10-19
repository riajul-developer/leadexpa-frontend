"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlarmClock,
  Bell,
  Bot,
  CheckCheck,
  CreditCard,
  Gauge,
  HeartPulse,
  Plug,
  TriangleAlert,
  UserPlus,
  Wallet,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { notificationKeys } from "@/shared/lib/query-keys";
import { useNow } from "@/shared/lib/sla";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";

import { BellButton, notificationsQuery, type Page } from "./bell";

type Notification = Schemas["Notification"];

const ICON: Record<string, typeof Bell> = {
  "lead.assigned": UserPlus,
  "sla.warning": AlarmClock,
  "sla.breached": TriangleAlert,
  "sla.escalated": TriangleAlert,
  "integration.health": Plug,
  "integration.token_expiring": Plug,
  "automation.alert": Zap,
  "payment.received": Wallet,
  "billing.payment_failed": CreditCard,
  "billing.budget": Gauge,
  "client.anomaly": Activity,
  "client.health": HeartPulse,
  "agent.handoff": Bot,
};

function hrefFor(n: Notification): string {
  if (n.lead_id) return `/leads/${n.lead_id}`;
  const data = n.data as { install_id?: unknown; destination_id?: unknown; client_id?: unknown };
  if (typeof data.destination_id === "string" && typeof data.client_id === "string")
    return `/clients/${data.client_id}/conversions`;
  const installId = data.install_id;
  if (typeof installId === "string") return `/integrations/sources/${installId}`;
  if (n.type.startsWith("integration.")) return "/integrations/meta";
  if (n.type.startsWith("billing.")) return "/settings/billing";
  if (n.type === "agent.handoff" && typeof (n.data as { conversation_id?: unknown }).conversation_id === "string")
    return `/agent?conversation=${(n.data as { conversation_id: string }).conversation_id}`;
  if (n.type.startsWith("client.") && typeof data.client_id === "string") return `/clients/${data.client_id}/health`;
  return "/inbox";
}

export function NotificationPopover({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useTranslations("notifications");
  const f = useFormat();
  const now = useNow();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const list = useQuery(notificationsQuery);

  const markRead = useMutation({
    mutationFn: (id: string) =>
      unwrapEmpty(api.POST("/v1/notifications/{notificationId}/read", { params: { path: { notificationId: id } } })),
    onMutate: (id) => {
      qc.setQueryData<Page>(notificationKeys.list(false), (old) =>
        old
          ? {
              ...old,
              unread_count: Math.max(0, old.unread_count - (old.data.find((n) => n.id === id && !n.read_at) ? 1 : 0)),
              data: old.data.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
            }
          : old,
      );
    },
  });
  const markAll = useMutation({
    mutationFn: () => unwrapEmpty(api.POST("/v1/notifications/read-all")),
    onMutate: () => {
      const at = new Date().toISOString();
      qc.setQueryData<Page>(notificationKeys.list(false), (old) =>
        old ? { ...old, unread_count: 0, data: old.data.map((n) => ({ ...n, read_at: n.read_at ?? at })) } : old,
      );
    },
  });

  const unread = list.data?.unread_count ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BellButton unread={unread} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={unread === 0}>
            <CheckCheck aria-hidden />
            {t("markAll")}
          </Button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto">
          {list.isPending ? (
            <div className="grid gap-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !list.data?.data.length ? (
            <EmptyState icon={Bell} title={t("empty")} />
          ) : (
            <ul>
              {list.data.data.map((n) => {
                const Icon = ICON[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "border-border hover:bg-surface-2 flex w-full gap-3 border-b px-3 py-2.5 text-start",
                        !n.read_at && "bg-primary-soft/40",
                      )}
                      onClick={() => {
                        if (!n.read_at) markRead.mutate(n.id);
                        setOpen(false);
                        router.push(hrefFor(n));
                      }}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          n.type.includes("breach") || n.type.includes("escalat") ? "text-danger" : "text-muted",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{n.title}</span>
                        <span className="text-muted block text-sm">{n.body}</span>
                        <span className="text-muted block text-xs">{f.relative(n.created_at, now || Date.now())}</span>
                      </span>
                      {!n.read_at && (
                        <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-label={t("unread")} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
