"use client";

import { MessagesSquare, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { useMembers } from "@/shared/lib/lookups";
import { useMe } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Badge, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useConversation, useInbox, type Conversation } from "./api";
import { ChannelIcon } from "./channel-icon";
import { Thread } from "./thread";

/**
 * The shared inbox (FRONTEND_PROMPT 17.1): conversation list · thread · lead info on desktop, a WhatsApp-like
 * single pane on phones. Every reply is logged on the lead and counts as the SLA response.
 */
export function ConversationsPage() {
  const t = useTranslations("conversations");
  const params = useSearchParams();
  const router = useRouter();
  const client = useActiveClient();
  const [unread, setUnread] = useState(false);
  const selected = params.get("c");
  const q = useInbox({ client: client ?? undefined, unread });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  const open = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("c", id);
    else next.delete("c");
    router.replace(`/conversations${next.size ? `?${next}` : ""}`);
  };

  return (
    // The lead column only exists while a conversation is open; with none, the message area takes the width (an empty
    // third column drew a stray border). The height leaves room for the bottom navigation on phones.
    <div className="flex h-[calc(100dvh-3.5rem-5rem)] min-h-0 flex-col pt-3 md:h-[calc(100dvh-3.5rem)] md:pt-4">
      <div
        className={cn(
          "bg-surface border-border grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden border-x border-t md:grid-cols-[20rem_1fr]",
          selected && "xl:grid-cols-[20rem_1fr_18rem]",
        )}
      >
        <aside className={cn("border-border flex min-h-0 flex-col border-e", selected && "hidden md:flex")}>
          <div className="flex items-center gap-2 p-3">
            <h1 className="flex-1 text-lg font-semibold">{t("title")}</h1>
            <div className="flex gap-1" role="radiogroup" aria-label={t("filter")}>
              {([false, true] as const).map((u) => (
                <Button
                  key={String(u)}
                  size="sm"
                  variant={unread === u ? "primary" : "secondary"}
                  role="radio"
                  aria-checked={unread === u}
                  onClick={() => setUnread(u)}
                >
                  {t(u ? "unread" : "all")}
                </Button>
              ))}
            </div>
          </div>
          {q.isPending ? (
            <div className="grid gap-2 p-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={MessagesSquare} title={t("empty")} description={t("emptyHint")} />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("listLabel")}>
              {items.map((c) => (
                <ListItem key={c.id} c={c} active={c.id === selected} onOpen={() => open(c.id)} />
              ))}
              {q.hasNextPage && (
                <li className="p-3 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void q.fetchNextPage()}
                    loading={q.isFetchingNextPage}
                  >
                    {t("more")}
                  </Button>
                </li>
              )}
            </ul>
          )}
        </aside>
        <div className={cn("min-h-0", !selected && "hidden md:block")}>
          {selected ? (
            <Thread key={selected} conversationId={selected} onBack={() => open(null)} />
          ) : (
            <EmptyState icon={MessagesSquare} title={t("pick")} className="h-full" />
          )}
        </div>
        {selected && (
          <aside className="border-border hidden min-h-0 overflow-y-auto border-s xl:block" aria-label={t("leadInfo")}>
            <LeadPane conversationId={selected} />
          </aside>
        )}
      </div>
    </div>
  );
}

function ListItem({ c, active, onOpen }: { c: Conversation; active: boolean; onOpen: () => void }) {
  const t = useTranslations("conversations");
  const f = useFormat();
  const now = useNow();
  const { data: me } = useMe();
  const someoneReplying = c.claimed_by && c.claimed_by !== me?.user.id;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cn(
          "border-border flex w-full gap-3 border-b px-3 py-3 text-start",
          active ? "bg-primary-soft" : "hover:bg-surface-2",
        )}
      >
        <ChannelIcon channel={c.channel} className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn("flex-1 truncate", c.unread_count > 0 ? "font-semibold" : "font-medium")}>
              {c.lead.name || c.lead.phone || "—"}
            </span>
            {c.last_message_at && (
              <span className="text-muted shrink-0 text-xs">{f.relative(c.last_message_at, now || Date.now())}</span>
            )}
          </span>
          <span className="text-muted flex items-center gap-2 text-sm">
            <span className="flex-1 truncate" dir="auto">
              {c.last_direction === "outbound" && `${t("you")}: `}
              {c.last_message_preview}
            </span>
            {someoneReplying && <UserRound className="text-warning size-3.5" aria-label={t("someoneReplying")} />}
            {c.unread_count > 0 && <Badge tone="primary">{c.unread_count}</Badge>}
          </span>
        </span>
      </button>
    </li>
  );
}

function LeadPane({ conversationId }: { conversationId: string }) {
  const t = useTranslations("conversations");
  const conv = useConversation(conversationId);
  const { byUserId } = useMembers();
  if (!conv.data) return null;
  const l = conv.data.lead;
  return (
    <div className="grid gap-3 p-4 text-sm">
      <div className="grid min-w-0 gap-1">
        <h2 className="truncate text-base font-semibold">{l.name || "—"}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {l.phone && (
            <p className="text-muted" dir="ltr">
              {l.phone}
            </p>
          )}
          <StageBadge stage={l.stage} />
        </div>
      </div>
      <p className="text-muted">
        {t("owner")}: {l.owner_user_id ? (byUserId.get(l.owner_user_id)?.user.name ?? "—") : t("unassigned")}
      </p>
      <Button asChild variant="secondary" size="sm">
        <Link href={`/leads/${l.id}`}>{t("openLead")}</Link>
      </Button>
    </div>
  );
}
