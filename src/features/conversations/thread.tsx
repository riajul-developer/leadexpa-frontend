"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, Send, Sparkles, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { toApiLocale, type AppLocale } from "@/shared/config/locales";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useMe } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect, Textarea } from "@/shared/ui/input";
import { Badge, EmptyState, Skeleton, Spinner } from "@/shared/ui/primitives";

import {
  useChannels,
  useClaim,
  useConversation,
  useMarkRead,
  useMessages,
  useSendReply,
  useTemplates,
  type Conversation,
  type Message,
} from "./api";
import { ChannelIcon } from "./channel-icon";

export function Thread({ conversationId, onBack }: { conversationId: string; onBack?: () => void }) {
  const t = useTranslations("conversations");
  const conv = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const markRead = useMarkRead(conversationId);
  const read = useRef(false);
  useEffect(() => {
    if (conv.data && conv.data.unread_count > 0 && !read.current) {
      read.current = true;
      markRead.mutate();
    }
  }, [conv.data, markRead]);

  if (conv.isPending) return <Skeleton className="m-4 h-64" />;
  if (!conv.data) return <EmptyState icon={AlertCircle} title={t("notFound")} />;
  const c = conv.data;
  const items = (messages.data?.pages.flatMap((p) => p.data) ?? []).slice().reverse();
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={t("threadLabel", { name: c.lead.name || "—" })}>
      <header className="border-border flex items-center gap-2 border-b px-3 py-2">
        {onBack && (
          <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label={t("back")}>
            <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
          </Button>
        )}
        <ChannelIcon channel={c.channel} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{c.lead.name || c.lead.phone || "—"}</h2>
          <WindowLine c={c} />
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/leads/${c.lead.id}`}>{t("openLead")}</Link>
        </Button>
      </header>
      <ClaimBanner c={c} />
      <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3" aria-live="polite">
        {messages.hasNextPage && (
          <li className="text-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void messages.fetchNextPage()}
              loading={messages.isFetchingNextPage}
            >
              {t("older")}
            </Button>
          </li>
        )}
        {messages.isPending && <Spinner />}
        {items.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
      </ol>
      <Composer c={c} />
    </section>
  );
}

function WindowLine({ c }: { c: Conversation }) {
  const t = useTranslations("conversations");
  const f = useFormat();
  const now = useNow();
  if (c.channel === "sms") return <p className="text-muted text-xs">{t("channel.sms")}</p>;
  const left = c.window_expires_at ? Math.round((Date.parse(c.window_expires_at) - (now || Date.now())) / 1000) : 0;
  return left > 0 ? (
    <p className="text-success text-xs">{t("windowOpen", { left: f.duration(left) })}</p>
  ) : (
    <p className="text-warning text-xs">{t(c.channel === "whatsapp" ? "windowClosedWhatsApp" : "windowClosedMeta")}</p>
  );
}

function ClaimBanner({ c }: { c: Conversation }) {
  const t = useTranslations("conversations");
  const { data: me } = useMe();
  const { byUserId } = useMembers();
  if (!c.claimed_by || c.claimed_by === me?.user.id) return null;
  return (
    <p role="status" className="bg-warning-soft text-warning flex items-center gap-2 px-3 py-2 text-sm">
      <UserRound className="size-4" aria-hidden />
      {t("replying", { name: byUserId.get(c.claimed_by)?.user.name ?? t("someone") })}
    </p>
  );
}

function Bubble({ m }: { m: Message }) {
  const t = useTranslations("conversations");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const out = m.direction === "outbound";
  return (
    <li className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
          out ? "bg-primary-soft rounded-ee-sm" : "bg-surface-2 rounded-es-sm",
        )}
      >
        {m.kind === "template" && (
          <span className="text-muted mb-1 block text-xs">{t("template", { name: m.template_name ?? "" })}</span>
        )}
        <span dir="auto">{m.body}</span>
        <span className="text-muted mt-1 flex items-center justify-end gap-1 text-[11px]">
          {m.automated && <Badge className="px-1 py-0">{t("auto")}</Badge>}
          <time dateTime={m.created_at}>{f.dateTime(m.created_at, tz, "time")}</time>
          {out && <Ticks m={m} />}
        </span>
        {m.status === "failed" && m.error && <span className="text-danger mt-1 block text-xs">{m.error}</span>}
      </div>
    </li>
  );
}

function Ticks({ m }: { m: Message }) {
  const t = useTranslations("conversations.status");
  const label = t(m.status);
  switch (m.status) {
    case "queued":
      return <Clock className="size-3.5" aria-label={label} />;
    case "sent":
      return <Check className="size-3.5" aria-label={label} />;
    case "delivered":
      return <CheckCheck className="size-3.5" aria-label={label} />;
    case "read":
      return <CheckCheck className="text-primary size-3.5" aria-label={label} />;
    case "failed":
      return <AlertCircle className="text-danger size-3.5" aria-label={label} />;
  }
  return null;
}

const KNOWN_ERRORS = new Set([
  "conversation_claimed",
  "template_required",
  "messaging_window_closed",
  "contact_not_allowed",
  "contact_deferred",
  "messaging_paused",
  "message_send_failed",
  "no_channel_account",
]);

function Composer({ c }: { c: Conversation }) {
  const t = useTranslations("conversations");
  const te = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const [text, setText] = useState("");
  const [template, setTemplate] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const send = useSendReply(c.id, c.lead.id);
  const { claim, release } = useClaim(c.id);
  const claimed = useRef(false);
  const channels = useChannels(c.client_id);
  const waAccount = channels.data?.data.find((a) => a.channel === "whatsapp" && a.status === "active");
  const templates = useTemplates(c.channel === "whatsapp" ? waAccount?.id : undefined);
  const approved = useMemo(() => (templates.data?.data ?? []).filter((x) => x.status === "approved"), [templates.data]);
  const now = useNow();
  const windowOpen = c.window_expires_at ? Date.parse(c.window_expires_at) > (now || Date.now()) : false;
  const templateOnly = c.channel === "whatsapp" && !windowOpen;
  const metaClosed = (c.channel === "messenger" || c.channel === "instagram") && !windowOpen;

  // Release the reply lock when leaving the conversation.
  useEffect(
    () => () => {
      if (claimed.current) release.mutate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.id],
  );

  const explain = (e: unknown) => toast.error(isApiError(e) && KNOWN_ERRORS.has(e.code) ? te(e.code) : te("internal"));

  const suggest = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/leads/{leadId}/assistant/draft", {
          params: { path: { leadId: c.lead.id } },
          body: { channel: c.channel === "sms" ? "sms" : "whatsapp", language: toApiLocale(locale), tone: "friendly" },
        }),
      ),
    meta: { silent: true },
    onSuccess: (r) => {
      setSuggestions(r.variants.map((v) => v.text));
      track("ai.reply_suggested", { channel: c.channel });
    },
    onError: () => toast.error(te("ai_unavailable")),
  });

  const submit = () => {
    if (templateOnly) {
      const tpl = approved.find((x) => x.id === template);
      if (!tpl) return;
      send.mutate(
        { template: { name: tpl.name, language: tpl.language } },
        { onSuccess: () => track("inbox.template_sent"), onError: explain },
      );
      return;
    }
    const body = text.trim();
    if (!body) return;
    send.mutate(
      { text: body },
      {
        onSuccess: () => {
          setText("");
          setSuggestions([]);
          track("inbox.reply_sent", { channel: c.channel });
        },
        onError: explain,
      },
    );
  };

  if (metaClosed) return <p className="border-border text-muted border-t p-3 text-sm">{t("metaClosedHint")}</p>;
  return (
    <form
      className="border-border grid gap-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("suggestions")}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="border-border bg-surface hover:bg-surface-2 max-w-xs truncate rounded-full border px-3 py-1 text-start text-xs"
                onClick={() => setText(s)}
                title={s}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {templateOnly ? (
        <div className="grid gap-2">
          <p className="text-muted text-xs">{t("templateHint")}</p>
          <NativeSelect value={template} onChange={(e) => setTemplate(e.target.value)} aria-label={t("pickTemplate")}>
            <option value="">{approved.length ? t("pickTemplate") : t("noTemplates")}</option>
            {approved.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.language}
              </option>
            ))}
          </NativeSelect>
          {template && (
            <p className="bg-surface-2 rounded-lg p-2 text-sm" dir="auto">
              {approved.find((x) => x.id === template)?.body}
            </p>
          )}
        </div>
      ) : (
        <Textarea
          value={text}
          rows={2}
          maxLength={4096}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          dir="auto"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            if (!claimed.current) {
              claimed.current = true;
              claim.mutate(undefined, { onError: explain });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
      )}
      <div className="flex items-center gap-2">
        {!templateOnly && c.channel !== "sms" && (
          <Button type="button" size="sm" variant="ghost" onClick={() => suggest.mutate()} loading={suggest.isPending}>
            <Sparkles aria-hidden />
            {t("suggest")}
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          className="ms-auto"
          loading={send.isPending}
          disabled={templateOnly ? !template : !text.trim()}
        >
          <Send className="rtl:-scale-x-100" aria-hidden />
          {templateOnly ? t("sendTemplate") : t("send")}
        </Button>
      </div>
    </form>
  );
}
