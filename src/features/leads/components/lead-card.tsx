"use client";

import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, type ReactNode } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { useNow } from "@/shared/lib/sla";
import { QualityBadge, ScoreBadge, StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/primitives";
import { SlaChip } from "@/shared/ui/sla-chip";

import type { Lead } from "../api/hooks";

import { contactHref, onContactClick } from "./contact-flow";

/** Memoized: SSE updates re-render only rows whose lead changed. */
export const LeadCard = memo(function LeadCard({
  lead,
  selected,
  focused,
  onOpen,
  onOutcome,
  hint,
  highlight,
}: {
  lead: Lead;
  selected?: boolean;
  focused?: boolean;
  onOpen: (lead: Lead) => void;
  onOutcome?: (lead: Lead) => void;
  hint?: ReactNode;
  highlight?: boolean;
}) {
  const t = useTranslations("leadCard");
  const f = useFormat();
  const now = useNow();
  const { byId } = useClients();
  const client = byId.get(lead.client_id);
  const name = lead.full_name || lead.phone?.display || t("unnamed");
  return (
    <article
      aria-label={name}
      aria-current={selected ? "true" : undefined}
      data-focused={focused || undefined}
      className={cn(
        "group border-border bg-surface flex items-start gap-3 border-b px-3 py-3 sm:px-4",
        selected && "bg-primary-soft/50",
        focused && "ring-primary ring-2 ring-inset",
        highlight && "motion-safe:animate-highlight",
      )}
    >
      <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onOpen(lead)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold">{name}</span>
          <SlaChip lead={lead} timeZone={client?.timezone} live={focused} />
          <span className="text-muted text-xs">
            {lead.last_activity_at
              ? t("lastActivity", { when: f.relative(lead.last_activity_at, now || Date.now()) })
              : t("received", { when: f.relative(lead.received_at, now || Date.now()) })}
          </span>
        </div>
        <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {client && <span className="truncate">{client.name}</span>}
          {lead.campaign && <span className="truncate">· {lead.campaign.name}</span>}
          <StageBadge stage={lead.stage} />
          <QualityBadge quality={lead.quality} />
          <ScoreBadge score={lead.score} />
          {lead.duplicate_count > 0 && (
            <span className="text-xs">· {t("duplicates", { count: lead.duplicate_count })}</span>
          )}
        </div>
        {hint}
      </button>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {lead.do_not_contact && (
          <Badge tone="danger" className="shrink-0">
            {t("doNotContact")}
          </Badge>
        )}
        {lead.phone && !lead.do_not_contact && (
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="secondary" size="icon" aria-label={t("call", { name })}>
              <a href={contactHref(lead, "call")} onClick={() => onContactClick(lead, "call")}>
                <Phone aria-hidden />
              </a>
            </Button>
            <Button asChild variant="secondary" size="icon" aria-label={t("whatsapp", { name })}>
              <a
                href={contactHref(lead, "whatsapp")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onContactClick(lead, "whatsapp")}
              >
                <MessageCircle className="text-success" aria-hidden />
              </a>
            </Button>
            {onOutcome && (
              <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => onOutcome(lead)}>
                {t("log")}
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
