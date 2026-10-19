"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Building2, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LeadSheet, LazyStageDialog, canMove, useLeadSheet, type Lead, type Stage } from "@/features/leads";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { useClients, useMembers } from "@/shared/lib/lookups";
import { useAgencyCurrency } from "@/shared/lib/preferences";
import { pipelineKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { STAGES, StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Avatar, EmptyState, Skeleton } from "@/shared/ui/primitives";
import { SlaChip } from "@/shared/ui/sla-chip";

const PAGE = 50;

function useColumn(clientId: string | undefined, stage: Stage) {
  return useInfiniteQuery({
    queryKey: [...pipelineKeys.board(clientId ?? "all"), stage],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/v1/leads", { params: { query: { client_id: clientId, stage, cursor: pageParam, limit: PAGE } } }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function Pipeline() {
  const t = useTranslations("pipeline");
  const agencyCurrency = useAgencyCurrency();
  const clientId = useActiveClient();
  const { byId } = useClients();
  const canUpdate = useCan("lead.update");
  const sheet = useLeadSheet();
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [pending, setPending] = useState<{ lead: Lead; to: Stage } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.lead as Lead | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const lead = e.active.data.current?.lead as Lead | undefined;
    const to = e.over?.id as Stage | undefined;
    if (!lead || !to || lead.stage === to || !canMove(lead.stage, to)) return;
    track("pipeline.card.dropped", { from: lead.stage, to });
    setPending({ lead, to });
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-5rem)] flex-col pt-3 md:h-[calc(100dvh-3.5rem)] md:pt-4">
      <div className="bg-surface border-border flex min-h-0 flex-1 flex-col overflow-hidden border-x border-t">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>
        {!clientId && (
          <p
            role="note"
            className="bg-info-soft text-info mx-3 mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm"
          >
            <Building2 className="size-4 shrink-0" aria-hidden />
            {t("allClientsWarning")}
          </p>
        )}
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
          accessibility={{ screenReaderInstructions: { draggable: t("dragInstructions") } }}
        >
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto p-3">
            {STAGES.map((s) => (
              <Column
                key={s}
                stage={s}
                clientId={clientId}
                dragging={dragging}
                draggable={canUpdate}
                onOpen={(l) => sheet.open(l.id)}
              />
            ))}
          </div>
          <DragOverlay>{dragging ? <CardBody lead={dragging} overlay /> : null}</DragOverlay>
        </DndContext>
        {pending && (
          <LazyStageDialog
            lead={pending.lead}
            to={pending.to}
            currency={byId.get(pending.lead.client_id)?.currency ?? agencyCurrency}
            onClose={() => setPending(null)}
          />
        )}
      </div>
      <LeadSheet />
    </div>
  );
}

function Column({
  stage,
  clientId,
  dragging,
  draggable,
  onOpen,
}: {
  stage: Stage;
  clientId?: string;
  dragging: Lead | null;
  draggable: boolean;
  onOpen: (l: Lead) => void;
}) {
  const t = useTranslations("pipeline");
  const q = useColumn(clientId, stage);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const leads = q.data?.pages.flatMap((p) => p.data) ?? [];
  const allowed = !dragging || dragging.stage === stage || canMove(dragging.stage, stage);
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${stage}`}
      className={cn(
        "border-border bg-surface-2 flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-md border sm:w-72",
        isOver && allowed && "border-primary bg-primary-soft",
        dragging && !allowed && "opacity-50",
      )}
    >
      <h2 id={`col-${stage}`} className="flex items-center justify-between px-3 py-2">
        <StageBadge stage={stage} />
        <span className="text-muted text-xs tabular-nums">
          {leads.length}
          {q.hasNextPage ? "+" : ""}
        </span>
      </h2>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {q.isPending ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : leads.length === 0 ? (
          <EmptyState title={t("emptyColumn")} className="py-6" />
        ) : (
          leads.map((l) => (
            <DraggableCard key={l.id} lead={l} draggable={draggable && stage !== "won"} onOpen={onOpen} />
          ))
        )}
        {q.hasNextPage && (
          <Button variant="ghost" size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
            {t("more")}
          </Button>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ lead, draggable, onOpen }: { lead: Lead; draggable: boolean; onOpen: (l: Lead) => void }) {
  const t = useTranslations("pipeline");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: !draggable,
  });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <div className="border-border bg-surface shadow-card flex items-stretch rounded-md border">
        {draggable && (
          <button
            type="button"
            className="text-muted hover:text-text flex items-center px-1"
            aria-label={t("dragHandle", { name: lead.full_name || "—" })}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onOpen(lead)}>
          <CardBody lead={lead} />
        </button>
      </div>
    </div>
  );
}

function CardBody({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const { byId } = useClients();
  const { byUserId } = useMembers();
  const owner = lead.owner_user_id ? byUserId.get(lead.owner_user_id)?.user.name : undefined;
  const client = byId.get(lead.client_id);
  return (
    <div className={cn("grid gap-1.5 p-2.5", overlay && "border-primary bg-surface shadow-pop w-64 rounded-md border")}>
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium">{lead.full_name || lead.phone?.display || "—"}</span>
        {owner && <Avatar name={owner} size="sm" />}
      </div>
      <span className="text-muted truncate text-xs">
        {client?.name}
        {lead.campaign ? ` · ${lead.campaign.name}` : ""}
      </span>
      <SlaChip lead={lead} timeZone={client?.timezone} className="justify-self-start" />
    </div>
  );
}
