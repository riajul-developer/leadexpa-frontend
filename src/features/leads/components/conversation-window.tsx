"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { useNow } from "@/shared/lib/sla";
import { Badge } from "@/shared/ui/primitives";

import { useConversations, type Activity, type Lead } from "../api/queries";

const DM_CHANNELS = new Set(["messenger", "instagram"]);

export function ConversationWindow({ lead, activities }: { lead: Lead; activities: Activity[] }) {
  const t = useTranslations("timeline");
  const tc = useTranslations("source");
  const f = useFormat();
  const now = useNow();
  const detail = (lead.custom_fields as Record<string, unknown> | null)?.source_detail;
  const isDM = DM_CHANNELS.has(String(detail)) || activities.some((a) => DM_CHANNELS.has(a.type));
  const q = useConversations(lead.id, isDM);
  const convs = q.data?.data ?? [];
  if (convs.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-4 pt-3" aria-label={t("windowTitle")}>
      {convs.map((c) => {
        const left = c.window_expires_at ? (Date.parse(c.window_expires_at) - (now || Date.now())) / 1000 : 0;
        const open = left > 0;
        return (
          <li key={c.id}>
            <Badge tone={open ? "success" : "warning"}>
              <Clock aria-hidden />
              {open
                ? t("windowOpen", { channel: tc(c.channel), left: f.duration(Math.round(left)) })
                : t("windowClosed", { channel: tc(c.channel) })}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
