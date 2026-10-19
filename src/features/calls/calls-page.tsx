"use client";

import { PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { Button } from "@/shared/ui/button";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useCalls, type Call } from "./api";
import { CallDetail } from "./call-detail";
import { CallStatusBadge } from "./status";

const Dialer = dynamic(() => import("./dialer").then((m) => m.Dialer));
const Coaching = dynamic(() => import("./coaching").then((m) => m.Coaching));

const VIEWS = ["calls", "dialer", "coaching"] as const;
type View = (typeof VIEWS)[number];

export function CallsPage() {
  const t = useTranslations("calls");
  const params = useSearchParams();
  const router = useRouter();
  const canCoach = useCan("report.read");
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "calls";
  const views = VIEWS.filter((v) => v !== "coaching" || canCoach);

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`/calls${p.size ? `?${p}` : ""}`);
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-5rem)] min-h-0 flex-col pt-3 md:h-[calc(100dvh-3.5rem)] md:pt-4">
      <div className="bg-surface border-border flex min-h-0 flex-1 flex-col overflow-hidden border-x border-t">
        <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h1 className="flex-1 text-lg font-semibold">{t("title")}</h1>
          <div className="flex gap-1" role="tablist" aria-label={t("views")}>
            {views.map((v) => (
              <Button
                key={v}
                size="sm"
                role="tab"
                aria-selected={view === v}
                variant={view === v ? "primary" : "secondary"}
                onClick={() => go({ view: v === "calls" ? null : v, c: null })}
              >
                {t(`view.${v}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1" role="tabpanel" aria-label={t(`view.${view}`)}>
          {view === "dialer" && <Dialer />}
          {view === "coaching" && <Coaching />}
          {view === "calls" && <CallList selected={params.get("c")} onOpen={(id) => go({ c: id })} />}
        </div>
      </div>
    </div>
  );
}

function CallList({ selected, onOpen }: { selected: string | null; onOpen: (id: string | null) => void }) {
  const t = useTranslations("calls");
  const client = useActiveClient();
  const q = useCalls({ client: client ?? undefined });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] md:grid-cols-[22rem_1fr]">
      <aside className={cn("border-border min-h-0 overflow-y-auto border-e", selected && "hidden md:block")}>
        {q.isPending ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={PhoneCall} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <ul aria-label={t("listLabel")}>
            {items.map((c) => (
              <CallRow key={c.id} c={c} active={c.id === selected} onOpen={() => onOpen(c.id)} />
            ))}
            {q.hasNextPage && (
              <li className="p-3 text-center">
                <Button size="sm" variant="ghost" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
                  {t("more")}
                </Button>
              </li>
            )}
          </ul>
        )}
      </aside>
      <div className={cn("min-h-0 overflow-y-auto", !selected && "hidden md:block")}>
        {selected ? (
          <CallDetail key={selected} callId={selected} onBack={() => onOpen(null)} />
        ) : (
          <EmptyState icon={PhoneCall} title={t("pick")} className="h-full" />
        )}
      </div>
    </div>
  );
}

export function DirectionIcon({ c, className }: { c: Pick<Call, "direction" | "status">; className?: string }) {
  const t = useTranslations("calls");
  const Icon = c.status === "missed" ? PhoneMissed : c.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  return (
    <Icon
      className={cn("size-4 shrink-0", c.status === "missed" ? "text-danger" : "text-muted", className)}
      aria-label={t(`direction.${c.direction}`)}
      role="img"
    />
  );
}

function CallRow({ c, active, onOpen }: { c: Call; active: boolean; onOpen: () => void }) {
  const f = useFormat();
  const now = useNow();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cn(
          "border-border flex w-full items-center gap-3 border-b px-3 py-3 text-start",
          active ? "bg-primary-soft" : "hover:bg-surface-2",
        )}
      >
        <DirectionIcon c={c} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="flex-1 truncate font-medium">
              {c.lead_name || f.phone(c.direction === "inbound" ? c.from : c.to)}
            </span>
            <span className="text-muted shrink-0 text-xs">{f.relative(c.started_at, now || Date.now())}</span>
          </span>
          <span className="text-muted flex items-center gap-2 text-sm">
            <CallStatusBadge status={c.status} />
            {c.duration_seconds > 0 && <span className="tabular-nums">{f.duration(c.duration_seconds)}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}
