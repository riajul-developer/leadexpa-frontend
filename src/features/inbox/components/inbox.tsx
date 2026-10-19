"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, Keyboard, PartyPopper, RefreshCw, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ContactFlowHost,
  LeadCard,
  LeadSheet,
  LazyStageDialog,
  contactHref,
  useContactFlow,
  useLeadSheet,
  useNextAction,
  type Lead,
  type Stage,
} from "@/features/leads";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { useAgencyCurrency, useDisplayTimeZone } from "@/shared/lib/preferences";
import { inboxKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";

type Section = "overdue" | "due_soon" | "callback_due" | "new" | "unassigned" | "in_progress";
type InboxLead = Lead & { section: Section };

const GROUPS: { key: string; sections: Section[] }[] = [
  { key: "overdue", sections: ["overdue"] },
  { key: "due_soon", sections: ["due_soon"] },
  { key: "callback_due", sections: ["callback_due"] },
  { key: "new", sections: ["new", "unassigned"] },
  { key: "others", sections: ["in_progress"] },
];

const StagePicker = dynamic(() => import("./inbox-dialogs").then((m) => m.StagePicker));
const ShortcutsHelp = dynamic(() => import("./inbox-dialogs").then((m) => m.ShortcutsHelp));

export function Inbox() {
  const t = useTranslations("inbox");
  const agencyCurrency = useAgencyCurrency();
  const qc = useQueryClient();
  const client = useActiveClient();
  const sheet = useLeadSheet();
  const showOutcome = useContactFlow((s) => s.showOutcome);
  const startContact = useContactFlow((s) => s.start);
  const { byId } = useClients();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [stageFor, setStageFor] = useState<{ lead: Lead; to: Stage } | null>(null);
  const [stagePicker, setStagePicker] = useState<Lead | null>(null);
  const [help, setHelp] = useState(false);
  const [helpOpened, setHelpOpened] = useState(false);
  if (help && !helpOpened) setHelpOpened(true);

  const [sort, setSort] = useState<"urgency" | "score">(() => {
    try {
      return localStorage.getItem("inbox-sort") === "score" ? "score" : "urgency";
    } catch {
      return "urgency";
    }
  });
  const changeSort = (v: "urgency" | "score") => {
    setSort(v);
    try {
      localStorage.setItem("inbox-sort", v);
    } catch {
      /* private mode */
    }
  };
  const query = useInfiniteQuery({
    queryKey: [...inboxKeys.all, sort],
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/v1/inbox", { params: { query: { cursor: pageParam, limit: 200, sort } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  useEffect(() => track("inbox.viewed"), []);

  const all = useMemo(() => (query.data?.pages.flatMap((p) => p.data) ?? []) as InboxLead[], [query.data]);
  // Filtered locally: the API returns the agent's whole queue.
  const leads = useMemo(() => (client ? all.filter((l) => l.client_id === client) : all), [all, client]);
  const groups = GROUPS.map((g) => ({ ...g, leads: leads.filter((l) => g.sections.includes(l.section)) })).filter(
    (g) => g.leads.length > 0,
  );
  const ordered = groups.flatMap((g) => (collapsed[g.key] ? [] : g.leads));

  // New-lead pill: never move rows under the user's finger.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [pill, setPill] = useState(0);
  useEffect(() => {
    if (!query.data) return;
    const ids = new Set(all.map((l) => l.id));
    if (seen.current) {
      const added = [...ids].filter((id) => !seen.current!.has(id));
      if (added.length) {
        setFresh(new Set(added));
        if (window.scrollY > 160) setPill((n) => n + added.length);
      }
    }
    seen.current = ids;
  }, [all, query.data]);

  const focusIndex = Math.max(
    0,
    ordered.findIndex((l) => l.id === focusId),
  );
  const focused = ordered[focusIndex];
  const move = useCallback(
    (delta: number) => {
      const next = ordered[Math.min(ordered.length - 1, Math.max(0, focusIndex + delta))];
      if (!next) return;
      setFocusId(next.id);
      document.querySelector(`[data-lead="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
    },
    [ordered, focusIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        el.closest("input,textarea,select,[contenteditable=true],[role=dialog]")
      )
        return;
      const lead = focused;
      switch (e.key) {
        case "j":
          move(1);
          break;
        case "k":
          move(-1);
          break;
        case "Enter":
          if (lead) sheet.open(lead.id);
          break;
        case "c":
        case "w": {
          const href = lead && contactHref(lead, e.key === "c" ? "call" : "whatsapp");
          if (lead && href) {
            startContact(lead, e.key === "c" ? "call" : "whatsapp");
            window.open(href, e.key === "c" ? "_self" : "_blank", "noopener,noreferrer");
          }
          break;
        }
        case "o":
          if (lead) showOutcome(lead, "call");
          break;
        case "s":
          if (lead) setStagePicker(lead);
          break;
        case "a":
          if (lead) {
            sheet.open(lead.id);
            track("inbox.shortcut.ai");
          }
          break;
        case "?":
          setHelp(true);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, move, sheet, showOutcome, startContact]);

  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: inboxKeys.all });

  if (query.isPending) {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto max-w-4xl"
      onTouchStart={(e) => {
        if (window.scrollY === 0) startY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (startY.current !== null) setPull(Math.max(0, Math.min(80, (e.touches[0]?.clientY ?? 0) - startY.current)));
      }}
      onTouchEnd={() => {
        if (pull > 60) void refresh();
        setPull(0);
        startY.current = null;
      }}
    >
      {pull > 0 && (
        <div className="text-muted flex justify-center py-2" style={{ height: pull }} aria-hidden>
          <RefreshCw
            className={cn("size-5", pull > 60 && "text-primary")}
            style={{ transform: `rotate(${pull * 4}deg)` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-1">
          <NativeSelect
            aria-label={t("sortLabel")}
            className="h-8 w-auto text-sm"
            value={sort}
            onChange={(e) => changeSort(e.target.value as "urgency" | "score")}
          >
            <option value="urgency">{t("sortUrgency")}</option>
            <option value="score">{t("sortScore")}</option>
          </NativeSelect>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void refresh()}
            aria-label={t("refresh")}
            loading={query.isRefetching}
          >
            {!query.isRefetching && <RefreshCw aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            onClick={() => setHelp(true)}
            aria-label={t("shortcuts")}
            aria-keyshortcuts="?"
          >
            <Keyboard aria-hidden />
          </Button>
        </div>
      </div>

      {pill > 0 && (
        <button
          type="button"
          className="bg-primary text-primary-fg shadow-pop sticky top-16 z-20 mx-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-sm"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setPill(0);
          }}
        >
          <ArrowUp className="size-4" aria-hidden />
          {t("newLeads", { count: pill })}
        </button>
      )}

      {groups.length === 0 ? (
        <AllCaughtUp leads={all} />
      ) : (
        groups.map((g) => {
          const open = !collapsed[g.key];
          return (
            <section key={g.key} aria-labelledby={`inbox-${g.key}`} className="mb-2">
              <h2 id={`inbox-${g.key}`}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-2 text-sm font-semibold",
                    g.key === "overdue" ? "text-danger" : g.key === "due_soon" ? "text-warning" : "text-muted",
                  )}
                  aria-expanded={open}
                  onClick={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}
                >
                  <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} aria-hidden />
                  {t(`section.${g.key}`)}
                  <span className="bg-surface-2 text-muted rounded-full px-2 text-xs tabular-nums">
                    {g.leads.length}
                  </span>
                </button>
              </h2>
              {open && (
                <div
                  className={cn(
                    "border-border overflow-hidden border-y md:mx-4 md:rounded-md md:border",
                    "md:[&>div:first-child>article]:rounded-t-sm md:[&>div:last-child>article]:rounded-b-sm",
                    "[&>div:last-child>article]:border-b-0",
                  )}
                >
                  {g.leads.map((l) => (
                    <div key={l.id} data-lead={l.id} onFocusCapture={() => setFocusId(l.id)}>
                      <LeadCard
                        lead={l}
                        selected={sheet.leadId === l.id}
                        focused={focused?.id === l.id}
                        highlight={fresh.has(l.id)}
                        hint={focused?.id === l.id ? <FocusedHint leadId={l.id} /> : undefined}
                        onOpen={(x) => {
                          setFocusId(x.id);
                          sheet.open(x.id);
                        }}
                        onOutcome={(x) => showOutcome(x, "call")}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
      {query.hasNextPage && (
        <div className="p-4 text-center">
          <Button variant="secondary" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
            {t("more")}
          </Button>
        </div>
      )}

      <LeadSheet />
      <ContactFlowHost />
      {stagePicker && (
        <StagePicker
          lead={stagePicker}
          onPick={(to) => {
            setStageFor({ lead: stagePicker, to });
            setStagePicker(null);
          }}
          onClose={() => setStagePicker(null)}
        />
      )}
      {stageFor && (
        <LazyStageDialog
          lead={stageFor.lead}
          to={stageFor.to}
          currency={byId.get(stageFor.lead.client_id)?.currency ?? agencyCurrency}
          onClose={() => setStageFor(null)}
        />
      )}
      {helpOpened && <ShortcutsHelp open={help} onOpenChange={setHelp} />}
    </div>
  );
}

/** Fetched only for the focused lead, never once per row. */
function FocusedHint({ leadId }: { leadId: string }) {
  const t = useTranslations("ai.nba.action");
  const q = useNextAction(leadId);
  if (!q.data || q.data.action === "none") return null;
  return (
    <div className="text-primary mt-1 flex items-center gap-1 text-xs">
      <Sparkles className="size-3" aria-hidden />
      <span className="truncate">{t(q.data.action)}</span>
    </div>
  );
}

function AllCaughtUp({ leads }: { leads: Lead[] }) {
  const t = useTranslations("inbox");
  const f = useFormat();
  const displayTz = useDisplayTimeZone();
  const { byId } = useClients();
  const next = leads
    .filter((l) => l.next_callback_at && Date.parse(l.next_callback_at) > Date.now())
    .sort((a, b) => Date.parse(a.next_callback_at!) - Date.parse(b.next_callback_at!))[0];
  return (
    <EmptyState
      icon={PartyPopper}
      title={t("caughtUp")}
      className="min-h-[calc(100dvh-3.5rem-3.5rem-5rem)] md:min-h-[calc(100dvh-3.5rem-3.5rem)]"
      description={
        next
          ? t("nextCallback", {
              time: f.dateTime(next.next_callback_at!, byId.get(next.client_id)?.timezone ?? displayTz, "short"),
            })
          : t("caughtUpHint")
      }
    />
  );
}
