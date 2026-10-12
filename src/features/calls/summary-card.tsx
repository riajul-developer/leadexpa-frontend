"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LazyStageDialog, canMove, needsDialog, useChangeStage, useLead, useLogActivity } from "@/features/leads";
import { useClients } from "@/shared/lib/lookups";
import { useAgencyCurrency } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/primitives";

import type { Call } from "./api";

type Summary = NonNullable<Call["summary"]>;

/**
 * AI call notes with "Apply to lead" (a note, plus the suggested stage). Loaded on demand: it pulls in the lead
 * mutations, which the Calls route should not carry on first load.
 */
export function SummaryCard({ c, s }: { c: Call; s: Summary }) {
  const t = useTranslations("calls.summary");
  const ts = useTranslations("stage");
  const canUpdate = useCan("lead.update");
  const lead = useLead(c.lead_id);
  const { byId } = useClients();
  const agencyCurrency = useAgencyCurrency();
  const [stageTo, setStageTo] = useState<"qualified" | "won" | "lost" | "contacted" | null>(null);
  const stage = s.suggested_stage !== "unchanged" ? s.suggested_stage : null;
  const l = lead.data;
  const note = useLogActivity(
    l ?? { id: c.lead_id, received_at: c.started_at, first_response_at: null, stage: "contacted" },
  );
  const change = useChangeStage(l ?? { id: c.lead_id, version: 0, stage: "contacted" });
  const movable = !!(l && stage && l.stage !== stage && canMove(l.stage, stage));
  const facts = [
    ["intent", s.intent],
    ["budget", s.budget],
    ["timeline", s.timeline],
    ["nextStep", s.next_step],
  ] as const;

  const apply = () => {
    if (!l) return;
    const body = [s.summary, s.next_step && `${t("nextStep")}: ${s.next_step}`].filter(Boolean).join("\n");
    note.mutate(
      { type: "note", body },
      {
        onSuccess: () => {
          toast.success(t("applied"));
          if (!movable || !stage) return;
          if (needsDialog(stage)) setStageTo(stage);
          else change.mutate({ to: stage });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Sparkles className="text-primary size-4" aria-hidden />
        <CardTitle className="flex-1">{t("title")}</CardTitle>
        <Badge tone={s.sentiment === "positive" ? "success" : s.sentiment === "negative" ? "danger" : "neutral"}>
          {t(`sentiment.${s.sentiment}`)}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p dir="auto">{s.summary}</p>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{t(k)}</dt>
                <dd dir="auto">{v}</dd>
              </div>
            ))}
        </dl>
        {s.objections.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted me-1">{t("objections")}</span>
            {s.objections.map((o) => (
              <Badge key={o} tone="warning">
                {o}
              </Badge>
            ))}
          </div>
        )}
        {canUpdate && l && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {movable && stage && <span className="text-muted">{t("suggests", { stage: ts(stage) })}</span>}
            <Button size="sm" onClick={apply} loading={note.isPending || change.isPending}>
              {t(movable ? "applyWithStage" : "apply")}
            </Button>
          </div>
        )}
        <p className="text-muted text-xs">{t("disclaimer")}</p>
      </CardContent>
      {stageTo && l && (
        <LazyStageDialog
          lead={l}
          to={stageTo}
          currency={byId.get(l.client_id)?.currency ?? agencyCurrency}
          onClose={() => setStageTo(null)}
        />
      )}
    </Card>
  );
}
