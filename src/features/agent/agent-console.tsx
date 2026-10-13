"use client";

import { Bot, Check, Hand, OctagonX, Play, Star, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/input";
import { Sheet, SheetContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type AgentConversation,
  type Draft,
  useAgentConversations,
  useConversationAction,
  useDecideDraft,
  useDrafts,
  useKillSwitch,
  useRateConversation,
  useSetKillSwitch,
  useTranscript,
} from "./api";

/** /agent: the AI agent console (17.12): kill switch, approval queue, live conversations. */
export function AgentConsole() {
  const t = useTranslations("agent");
  const drafts = useDrafts();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const open = params.get("conversation");
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bot className="text-accent size-6" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted text-sm">{t("subtitle")}</p>
      </header>
      <KillSwitch />
      <Tabs defaultValue={open ? "live" : "queue"}>
        <TabsList>
          <TabsTrigger value="queue">
            {t("tabs.queue")}
            {(drafts.data?.data.length ?? 0) > 0 && (
              <Badge tone="primary" className="ms-1.5">
                {drafts.data!.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="live">{t("tabs.live")}</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-4">
          <ApprovalQueue />
        </TabsContent>
        <TabsContent value="live" className="mt-4">
          <LiveMonitor onOpen={(id) => router.replace(`${pathname}?conversation=${id}`)} />
        </TabsContent>
      </Tabs>
      {open && <TranscriptSheet id={open} onClose={() => router.replace(pathname)} />}
    </div>
  );
}

function KillSwitch() {
  const t = useTranslations("agent.kill");
  const canManage = useCan("agency.update");
  const sw = useKillSwitch();
  const set = useSetKillSwitch();
  const killed = sw.data?.killed ?? false;
  return (
    <div
      role="region"
      aria-label={t("label")}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-4",
        killed ? "border-danger/40 bg-danger-soft" : "border-border bg-surface",
      )}
    >
      <OctagonX className={cn("size-6 shrink-0", killed ? "text-danger" : "text-muted")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{killed ? t("stopped") : t("running")}</p>
        <p className="text-muted text-sm">{killed ? t("stoppedHint") : t("runningHint")}</p>
      </div>
      {canManage && (
        <Button
          variant={killed ? "primary" : "danger"}
          loading={set.isPending}
          onClick={() => {
            if (!killed && !window.confirm(t("confirm"))) return;
            set.mutate(!killed, { onSuccess: (r) => toast.success(r.killed ? t("stoppedToast") : t("startedToast")) });
          }}
        >
          {killed ? <Play aria-hidden /> : <OctagonX aria-hidden />}
          {killed ? t("start") : t("stop")}
        </Button>
      )}
    </div>
  );
}

function ApprovalQueue() {
  const t = useTranslations("agent.queue");
  const drafts = useDrafts();
  if (!drafts.data) return <Skeleton className="h-40 w-full" />;
  if (drafts.data.data.length === 0) return <EmptyState title={t("empty")} description={t("emptyHint")} />;
  return (
    <ul className="grid gap-3">
      {drafts.data.data.map((d) => (
        <DraftCard key={d.id} draft={d} />
      ))}
    </ul>
  );
}

/** One reply waiting for approval. On touch screens, swipe right to send, left to discard. */
function DraftCard({ draft }: { draft: Draft }) {
  const t = useTranslations("agent.queue");
  const te = useTranslations("errors");
  const f = useFormat();
  const decide = useDecideDraft({
    sent: t("sent"),
    discarded: t("discarded"),
    failed: (e) => (isApiError(e) && te.has(e.code) ? te(e.code) : t("failed")),
  });
  const [text, setText] = useState(draft.reply);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const act = (approve: boolean) =>
    decide.mutate({ id: draft.id, approve, text: text === draft.reply ? undefined : text });
  return (
    <li
      className="relative touch-pan-y"
      data-draft={draft.lead_name}
      onPointerDown={(e) => e.pointerType === "touch" && (start.current = e.clientX)}
      onPointerMove={(e) => start.current != null && setDx(e.clientX - start.current)}
      onPointerUp={() => {
        if (start.current != null && Math.abs(dx) > 120) act(dx > 0);
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <Card
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={cn(dx > 60 && "border-success", dx < -60 && "border-danger")}
      >
        <CardContent className="grid gap-3 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {draft.lead_name || "—"} <span className="text-muted font-normal">· {draft.client_name}</span>
            </span>
            <span className="text-muted text-xs">{f.relative(draft.created_at, Date.now())}</span>
          </div>
          {draft.last_inbound && <p className="bg-surface-2 rounded-lg p-2.5 text-sm">{draft.last_inbound}</p>}
          <label className="grid gap-1 text-sm">
            <span className="text-muted text-xs">{t("aiReply")}</span>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {draft.citations.length > 0 && (
            <p className="text-muted text-xs">{t("sources", { count: draft.citations.length })}</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => act(false)} disabled={decide.isPending}>
              <X aria-hidden />
              {t("discard")}
            </Button>
            <Button size="sm" onClick={() => act(true)} loading={decide.isPending && decide.variables?.approve}>
              <Check aria-hidden />
              {text === draft.reply ? t("approve") : t("sendEdited")}
            </Button>
          </div>
          <p className="text-muted text-center text-xs md:hidden">{t("swipe")}</p>
        </CardContent>
      </Card>
    </li>
  );
}

const STATUS_TONE = { active: "success", handed_off: "warning", ended: "neutral" } as const;

function LiveMonitor({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useTranslations("agent.live");
  const tr = useTranslations("agent.reason");
  const f = useFormat();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const q = useAgentConversations(status);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("filter")}>
        {[undefined, "active", "handed_off"].map((s) => (
          <Button
            key={s ?? "all"}
            size="sm"
            variant={status === s ? "primary" : "secondary"}
            onClick={() => setStatus(s)}
          >
            {t(`status.${s ?? "all"}`)}
          </Button>
        ))}
      </div>
      {!q.data ? (
        <Skeleton className="h-40 w-full" />
      ) : q.data.data.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="divide-border border-border grid divide-y rounded-xl border">
          {q.data.data.map((c) => (
            <li key={c.conversation_id} data-conversation={c.lead_name}>
              <button
                type="button"
                className="hover:bg-surface-2 flex w-full items-center gap-3 p-3 text-start"
                onClick={() => onOpen(c.conversation_id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {c.lead_name || "—"} <span className="text-muted font-normal">· {c.client_name}</span>
                  </span>
                  <span className="text-muted block truncate text-xs">
                    {c.handoff_reason ? reasonText(tr, c.handoff_reason) : c.summary || t("turns", { count: c.turns })}
                  </span>
                </span>
                {c.needs_review && <Badge tone="info">{t("review")}</Badge>}
                {c.language && <Badge>{c.language.toUpperCase()}</Badge>}
                <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                {c.last_turn_at && (
                  <span className="text-muted hidden text-xs sm:inline">{f.relative(c.last_turn_at, Date.now())}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function reasonText(tr: ReturnType<typeof useTranslations>, reason: string) {
  const [head, detail] = reason.split(":");
  if (head === "blocked") return tr("blocked", { why: tr.has(`why.${detail}`) ? tr(`why.${detail}`) : (detail ?? "") });
  if (head === "send_failed") return tr("send_failed");
  return tr.has(head!) ? tr(head!) : reason;
}

function TranscriptSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("agent.transcript");
  const tr = useTranslations("agent.reason");
  const tl = useTranslations("agent.live");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const q = useTranscript(id);
  const action = useConversationAction();
  const rate = useRateConversation();
  const c: AgentConversation | undefined = q.data?.conversation;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={c ? `${c.lead_name || t("title")} · ${c.client_name}` : t("title")}>
        {!q.data || !c ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[c.status]}>{tl(`status.${c.status}`)}</Badge>
              {c.handoff_reason && <span className="text-muted text-sm">{reasonText(tr, c.handoff_reason)}</span>}
              <span className="ms-auto">
                {c.status === "active" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={action.isPending}
                    onClick={() =>
                      action.mutate({ id, action: "take-over" }, { onSuccess: () => toast.success(t("takenOver")) })
                    }
                  >
                    <Hand aria-hidden />
                    {t("takeOver")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={action.isPending}
                    onClick={() =>
                      action.mutate({ id, action: "resume" }, { onSuccess: () => toast.success(t("resumed")) })
                    }
                  >
                    <Play aria-hidden />
                    {t("resume")}
                  </Button>
                )}
              </span>
            </div>
            {c.summary && <p className="bg-surface-2 rounded-lg p-3 text-sm">{c.summary}</p>}
            {Object.keys(c.collected).length > 0 && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(c.collected).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted text-xs">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <ol className="grid gap-2" aria-label={t("messages")}>
              {q.data.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    m.direction === "inbound" ? "bg-surface-2 justify-self-start" : "bg-primary-soft justify-self-end",
                  )}
                >
                  <p className="whitespace-pre-wrap" dir="auto">
                    {m.body}
                  </p>
                  <p className="text-muted mt-1 text-[11px]">
                    {f.dateTime(m.created_at, tz, "time")}
                    {m.automated && ` · ${t("ai")}`}
                  </p>
                </li>
              ))}
            </ol>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">{t("turns", { count: q.data.turns.length })}</summary>
              <ul className="mt-2 grid gap-2">
                {q.data.turns.map((turn) => (
                  <li key={turn.id} className="border-border rounded-lg border p-2" data-turn={turn.decision}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={turn.decision === "sent" ? "success" : turn.decision === "queued" ? "info" : "warning"}
                      >
                        {t(`decision.${turn.decision}`)}
                      </Badge>
                      {turn.reason && <span className="text-muted text-xs">{reasonText(tr, turn.reason)}</span>}
                      <span className="text-muted ms-auto text-xs">
                        {t("sources", { count: turn.retrieved.length })}
                      </span>
                    </div>
                    {turn.reply && (
                      <p className="text-muted mt-1 text-xs" dir="auto">
                        {turn.reply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
            {c.status !== "active" && (
              <div className="border-border grid gap-2 border-t pt-3">
                <p className="text-sm font-medium">{t("rate")}</p>
                <div className="flex gap-1" role="radiogroup" aria-label={t("rate")}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={c.quality === n}
                      aria-label={t("stars", { n })}
                      className="p-1"
                      onClick={() => rate.mutate({ id, quality: n }, { onSuccess: () => toast.success(t("rated")) })}
                    >
                      <Star
                        className={cn("size-5", (c.quality ?? 0) >= n ? "fill-accent text-accent" : "text-muted")}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
