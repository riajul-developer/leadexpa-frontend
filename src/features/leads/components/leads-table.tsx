"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bookmark, Columns3, Rows3, Search, SearchX, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { useSearchState } from "@/shared/hooks/use-search-state";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { toLatinDigits } from "@/shared/lib/format";
import { useClients, useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { inboxKeys, leadKeys, type LeadFilters } from "@/shared/lib/query-keys";
import { useMe } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { QualityBadge, STAGES, ScoreBadge, StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Input, NativeSelect } from "@/shared/ui/input";
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/overlays";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";
import { SlaChip } from "@/shared/ui/sla-chip";

import type { Lead } from "../api/hooks";

import { useLeadSheet } from "./lead-sheet";

const FILTER_KEYS = ["stage", "owner", "q", "from", "to", "view", "quality", "campaign", "sla"] as const;

const BUILT_IN_VIEWS = {
  unassigned_today: () => ({ owner: "unassigned", from: today(), stage: "new,contacted" }),
  new_today: () => ({ stage: "new", from: today() }),
  hot_qualified: () => ({ stage: "qualified" }),
  my_open: () => ({ owner: "me", stage: "new,contacted,qualified" }),
} as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface SavedView {
  name: string;
  query: string;
}
const VIEWS_KEY = "recov-saved-views";

const DEFAULT_VISIBILITY: VisibilityState = {
  campaign: false,
  first_response: false,
  last_activity: false,
  value: false,
};
function loadViews(): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "[]") as SavedView[];
  } catch {
    return [];
  }
}

const COLS_KEY = "recov-leads-columns";

// Own ticker subscriber: `now` in the column defs would remount every cell on each tick.
function Relative({ at }: { at: string }) {
  const f = useFormat();
  const now = useNow();
  return <>{f.relative(at, now || Date.now())}</>;
}

export function LeadsTable() {
  const t = useTranslations("leadsTable");
  const displayTz = useDisplayTimeZone();
  const ts = useTranslations("stage");
  const f = useFormat();
  const client = useActiveClient();
  const { byId } = useClients();
  const { members, byUserId } = useMembers();
  const { data: me } = useMe();
  const sheet = useLeadSheet();
  const router = useRouter();
  const pathname = usePathname();
  const [s, set] = useSearchState(FILTER_KEYS);
  const [q, setQ] = useState(s.q ?? "");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [views, setViews] = useState<SavedView[]>([]);
  const [visibility, setVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);
  useEffect(() => {
    setViews(loadViews());
    try {
      setVisibility({
        ...DEFAULT_VISIBILITY,
        ...(JSON.parse(localStorage.getItem(COLS_KEY) ?? "{}") as VisibilityState),
      });
    } catch {
      /* defaults */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(visibility));
    } catch {
      /* ignore */
    }
  }, [visibility]);
  // Debounced; normalizes Bangla digits (০১৭… → 017…).
  useEffect(() => {
    const id = setTimeout(() => {
      const v = toLatinDigits(q.trim());
      if (v !== (s.q ?? "")) set({ q: v }, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [q, s.q, set]);

  const filters: LeadFilters = {
    client_id: client,
    stage: s.stage,
    owner: s.owner === "me" ? me?.user.id : s.owner,
    q: s.q,
    received_from: s.from ? new Date(s.from + "T00:00:00").toISOString() : undefined,
    received_to: s.to ? new Date(s.to + "T23:59:59").toISOString() : undefined,
    quality: s.quality as LeadFilters["quality"],
    campaign_id: s.campaign,
    sla: s.sla === "overdue" ? "overdue" : undefined,
  };
  const query = useInfiniteQuery({
    queryKey: leadKeys.list(filters),
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/v1/leads", { params: { query: { ...filters, cursor: pageParam, limit: 100 } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: s.owner !== "me" || !!me,
  });
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);

  const junkView = s.quality === "junk";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [s.quality]);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      ...(junkView
        ? [
            {
              id: "select",
              header: () => (
                <Checkbox
                  aria-label={t("selectAll")}
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              ),
              cell: ({ row }) => (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={t("selectLead", { name: row.original.full_name || "—" })}
                    checked={selected.has(row.original.id)}
                    onCheckedChange={() => toggle(row.original.id)}
                  />
                </span>
              ),
              enableHiding: false,
            } satisfies ColumnDef<Lead>,
          ]
        : []),
      {
        id: "name",
        header: t("col.name"),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span className="font-medium">{row.original.full_name || "—"}</span>
            <QualityBadge quality={row.original.quality} />
            <ScoreBadge score={row.original.score} />
          </span>
        ),
        enableHiding: false,
      },
      {
        id: "phone",
        header: t("col.phone"),
        cell: ({ row }) => <span className="tabular-nums">{row.original.phone?.display ?? "—"}</span>,
      },
      { id: "client", header: t("col.client"), cell: ({ row }) => byId.get(row.original.client_id)?.name ?? "—" },
      { id: "campaign", header: t("col.campaign"), cell: ({ row }) => row.original.campaign?.name ?? "—" },
      { id: "stage", header: t("col.stage"), cell: ({ row }) => <StageBadge stage={row.original.stage} /> },
      {
        id: "owner",
        header: t("col.owner"),
        cell: ({ row }) =>
          row.original.owner_user_id ? (
            (byUserId.get(row.original.owner_user_id)?.user.name ?? "—")
          ) : (
            <span className="text-muted">{t("unassigned")}</span>
          ),
      },
      {
        id: "sla",
        header: t("col.sla"),
        cell: ({ row }) => <SlaChip lead={row.original} timeZone={byId.get(row.original.client_id)?.timezone} />,
      },
      {
        id: "received",
        header: t("col.received"),
        cell: ({ row }) => (
          <time
            dateTime={row.original.received_at}
            title={f.dateTime(row.original.received_at, byId.get(row.original.client_id)?.timezone ?? displayTz)}
          >
            <Relative at={row.original.received_at} />
          </time>
        ),
      },
      {
        id: "first_response",
        header: t("col.firstResponse"),
        cell: ({ row }) => {
          const l = row.original;
          return l.first_response_at
            ? f.duration((Date.parse(l.first_response_at) - Date.parse(l.received_at)) / 1000)
            : "—";
        },
      },
      {
        id: "last_activity",
        header: t("col.lastActivity"),
        cell: ({ row }) => (row.original.last_activity_at ? <Relative at={row.original.last_activity_at} /> : "—"),
      },
      { id: "value", header: t("col.value"), cell: ({ row }) => f.money(row.original.deal_value) },
    ],

    [t, byId, byUserId, f, displayTz, junkView, selected, rows],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = density === "compact" ? 40 : 52;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = items[items.length - 1];
    if (last && last.index >= rows.length - 20 && query.hasNextPage && !query.isFetchingNextPage)
      void query.fetchNextPage();
  }, [items, rows.length, query]);

  const [focus, setFocus] = useState(0);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      setFocus((i) => Math.min(rows.length - 1, i + 1));
      virtualizer.scrollToIndex(Math.min(rows.length - 1, focus + 1));
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      setFocus((i) => Math.max(0, i - 1));
      virtualizer.scrollToIndex(Math.max(0, focus - 1));
    } else if (e.key === "Enter" && rows[focus]) {
      sheet.open(rows[focus]!.id);
    }
  };

  const applyView = (key: keyof typeof BUILT_IN_VIEWS) => {
    track("leads.view.applied", { view: key });
    const preset: Partial<Record<(typeof FILTER_KEYS)[number], string>> = BUILT_IN_VIEWS[key]();
    set({ stage: preset.stage, owner: preset.owner, from: preset.from, to: preset.to, q: undefined, view: key });
  };
  const saveView = () => {
    const name = window.prompt(t("viewName"));
    if (!name) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("lead");
    const next = [...views.filter((v) => v.name !== name), { name, query: params.toString() }];
    setViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
  };
  const hasFilters = !!(s.stage || s.owner || s.q || s.from || s.to || s.quality || s.campaign || s.sla);

  return (
    <div className="flex h-[calc(100dvh-3.5rem-5rem)] flex-col pt-3 md:h-[calc(100dvh-3.5rem)] md:pt-4">
      {/* The filter bar is the visual header; the h1 is for screen readers. */}
      <h1 className="sr-only">{t("title")}</h1>
      <div className="bg-surface border-border flex min-h-0 flex-1 flex-col overflow-hidden border-x border-t">
        <div className="border-border flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full sm:w-64">
            <Search
              className="text-muted pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              className="ps-9"
              aria-label={t("search")}
              type="search"
            />
          </div>
          <NativeSelect
            className="w-36"
            value={s.stage ?? ""}
            onChange={(e) => set({ stage: e.target.value, view: undefined })}
            aria-label={t("col.stage")}
          >
            <option value="">{t("allStages")}</option>
            {STAGES.map((st) => (
              <option key={st} value={st}>
                {ts(st)}
              </option>
            ))}
            <option value="new,contacted,qualified">{t("openStages")}</option>
          </NativeSelect>
          <NativeSelect
            className="w-36"
            value={s.owner ?? ""}
            onChange={(e) => set({ owner: e.target.value, view: undefined })}
            aria-label={t("col.owner")}
          >
            <option value="">{t("anyOwner")}</option>
            <option value="me">{t("me")}</option>
            <option value="unassigned">{t("unassigned")}</option>
            {members
              .filter((m) => m.status === "active")
              .map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
          </NativeSelect>
          <NativeSelect
            className="w-36"
            value={s.quality ?? ""}
            onChange={(e) => set({ quality: e.target.value || undefined, view: undefined })}
            aria-label={t("quality.label")}
          >
            <option value="">{t("quality.default")}</option>
            <option value="suspect">{t("quality.suspect")}</option>
            <option value="junk">{t("quality.junk")}</option>
            <option value="all">{t("quality.all")}</option>
          </NativeSelect>
          {/* The focused half rises so its ring isn't clipped. */}
          <div className="flex items-center">
            <Input
              type="date"
              className="relative w-auto rounded-e-none focus-visible:z-10"
              value={s.from ?? ""}
              onChange={(e) => set({ from: e.target.value, view: undefined })}
              aria-label={t("from")}
            />
            <Input
              type="date"
              className="relative -ms-px w-auto rounded-s-none focus-visible:z-10"
              value={s.to ?? ""}
              onChange={(e) => set({ to: e.target.value, view: undefined })}
              aria-label={t("to")}
            />
          </div>
          {s.campaign && (
            <Button variant="secondary" size="sm" onClick={() => set({ campaign: undefined })}>
              {t("campaignFilter")}
              <X aria-label={t("removeFilter")} />
            </Button>
          )}
          {s.sla === "overdue" && (
            <Button variant="secondary" size="sm" onClick={() => set({ sla: undefined })}>
              {t("overdueOnly")}
              <X aria-label={t("removeFilter")} />
            </Button>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                set({
                  stage: undefined,
                  owner: undefined,
                  q: undefined,
                  from: undefined,
                  to: undefined,
                  view: undefined,
                  quality: undefined,
                  campaign: undefined,
                  sla: undefined,
                });
              }}
            >
              <X aria-hidden />
              {t("clear")}
            </Button>
          )}
          <div className="ms-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Bookmark aria-hidden />
                  {s.view && s.view in BUILT_IN_VIEWS ? t(`views.${s.view}`) : t("views.title")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(BUILT_IN_VIEWS) as (keyof typeof BUILT_IN_VIEWS)[]).map((k) => (
                  <DropdownMenuItem key={k} onSelect={() => applyView(k)}>
                    {t(`views.${k}`)}
                  </DropdownMenuItem>
                ))}
                {views.length > 0 && <DropdownMenuSeparator />}
                {views.length > 0 && <DropdownMenuLabel>{t("views.mine")}</DropdownMenuLabel>}
                {views.map((v) => (
                  <DropdownMenuItem key={v.name} onSelect={() => router.push(`${pathname}?${v.query}`)}>
                    <span className="flex-1 truncate">{v.name}</span>
                    <button
                      type="button"
                      aria-label={t("views.delete", { name: v.name })}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = views.filter((x) => x.name !== v.name);
                        setViews(next);
                        localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
                      }}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={saveView}>{t("views.save")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("columns")}>
                  <Columns3 aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56">
                <p className="text-muted mb-2 text-xs font-medium">{t("columns")}</p>
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                      <Checkbox checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(v === true)} />
                      {String(c.columnDef.header)}
                    </label>
                  ))}
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("density")}
              aria-pressed={density === "compact"}
              onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
            >
              <Rows3 aria-hidden />
            </Button>
          </div>
        </div>

        {junkView && <JunkBar selected={[...selected]} onDone={() => setSelected(new Set())} />}
        {query.isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={hasFilters ? t("noMatch") : t("empty")}
            description={hasFilters ? t("noMatchHint") : undefined}
          />
        ) : (
          // axe scrollable-region-focusable: scrollers must be keyboard-focusable.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            ref={parentRef}
            // relative: keeps the sr-only labels inside the scroller (no second page scrollbar).
            className="relative min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline-offset-[-2px]"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            onKeyDown={onKeyDown}
            role="region"
            aria-label={t("title")}
          >
            <table
              className="w-full min-w-[760px] border-separate border-spacing-0 text-sm"
              aria-rowcount={rows.length}
            >
              <thead className="bg-surface sticky top-0 z-10">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        scope="col"
                        className="border-border text-muted border-b px-3 py-2 text-start font-medium whitespace-nowrap"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {items[0] && items[0].start > 0 && <tr style={{ height: items[0].start }} aria-hidden />}
                {items.map((vi) => {
                  const row = table.getRowModel().rows[vi.index]!;
                  return (
                    <tr
                      key={row.id}
                      aria-rowindex={vi.index + 1}
                      onClick={() => {
                        setFocus(vi.index);
                        sheet.open(row.original.id);
                      }}
                      className={cn(
                        "hover:bg-surface-2 cursor-pointer",
                        vi.index === focus && "bg-primary-soft/40",
                        sheet.leadId === row.original.id && "bg-primary-soft",
                      )}
                      style={{ height: rowHeight }}
                    >
                      {row.getVisibleCells().map((c) => (
                        <td key={c.id} className="border-border border-b px-3 whitespace-nowrap">
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {items.length > 0 && (
                  <tr
                    style={{ height: virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0) }}
                    aria-hidden
                  />
                )}
              </tbody>
            </table>
            {query.isFetchingNextPage && <p className="text-muted p-3 text-center text-sm">{t("loadingMore")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function JunkBar({ selected, onDone }: { selected: string[]; onDone: () => void }) {
  const t = useTranslations("leadsTable");
  const qc = useQueryClient();
  const relabel = useMutation({
    mutationFn: (status: "valid" | "junk") =>
      unwrap(api.POST("/v1/leads/quality", { body: { lead_ids: selected, status } })),
    onSuccess: (r, status) => {
      track("leads.quality.relabeled", { status, count: r.data.length });
      toast.success(
        status === "valid"
          ? t("quality.restored", { count: r.data.length })
          : t("quality.confirmed", { count: r.data.length }),
      );
      void qc.invalidateQueries({ queryKey: leadKeys.all });
      void qc.invalidateQueries({ queryKey: inboxKeys.all });
      void qc.invalidateQueries({ queryKey: ["lead-quality-counts"] });
      onDone();
    },
  });
  return (
    <div className="border-border bg-surface-2 flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
      <span className="text-muted">{t("quality.bucketHint")}</span>
      <span className="ms-auto font-medium">{t("quality.selected", { count: selected.length })}</span>
      <Button
        size="sm"
        variant="secondary"
        disabled={!selected.length}
        loading={relabel.isPending && relabel.variables === "valid"}
        onClick={() => relabel.mutate("valid")}
      >
        {t("quality.restore")}
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={!selected.length}
        loading={relabel.isPending && relabel.variables === "junk"}
        onClick={() => relabel.mutate("junk")}
      >
        {t("quality.confirm")}
      </Button>
    </div>
  );
}
