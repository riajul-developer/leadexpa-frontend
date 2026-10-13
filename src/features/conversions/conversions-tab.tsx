"use client";

import { Plus, ShieldCheck, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useConversions, useSetTerms } from "./api";
import { DestinationCard } from "./destination-card";

const AddDestinationDialog = dynamic(() => import("./add-destination").then((m) => m.AddDestinationDialog));

/** Clients → Conversions: send qualified and won leads back to Meta and Google so campaigns optimize for buyers. */
export function ConversionsTab({ clientId }: { clientId: string }) {
  const t = useTranslations("conversions");
  const q = useConversions(clientId);
  const [adding, setAdding] = useState(false);

  if (q.isPending) return <Skeleton className="h-72 w-full" />;
  if (!q.data) return null;
  const { settings, destinations } = q.data;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Sparkles className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <p className="text-muted text-sm">{t("explainer")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Terms clientId={clientId} accepted={settings.accepted} at={settings.accepted_at} by={settings.accepted_by} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("destinations")}</CardTitle>
            <p className="text-muted text-sm">{t("destinationsHint")}</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {destinations.length === 0 ? (
            <EmptyState title={t("empty")} description={t("emptyHint")} />
          ) : (
            destinations.map((d) => <DestinationCard key={d.id} d={d} accepted={settings.accepted} />)
          )}
        </CardContent>
      </Card>
      {adding && <AddDestinationDialog clientId={clientId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Terms({
  clientId,
  accepted,
  at,
  by,
}: {
  clientId: string;
  accepted: boolean;
  at: string | null;
  by: string | null;
}) {
  const t = useTranslations("conversions.terms");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const { members } = useMembers();
  const set = useSetTerms(clientId);
  const [confirm, setConfirm] = useState(false);

  if (accepted)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ShieldCheck className="text-success size-4" aria-hidden />
        <span>
          {t("accepted", {
            who: members.find((m) => m.user.id === by)?.user.name ?? "—",
            when: at ? f.dateTime(at, tz, "date") : "—",
          })}
        </span>
        <Button
          size="sm"
          variant="ghost"
          loading={set.isPending}
          onClick={() =>
            window.confirm(t("withdrawConfirm")) &&
            set.mutate(false, { onSuccess: () => toast.success(t("withdrawn")) })
          }
        >
          {t("withdraw")}
        </Button>
      </div>
    );

  return (
    <div className="grid gap-3">
      <ul className="text-muted grid list-disc gap-1 ps-5 text-sm">
        <li>{t("point1")}</li>
        <li>{t("point2")}</li>
        <li>{t("point3")}</li>
      </ul>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
        {t("confirm")}
      </label>
      <Button
        className="w-fit"
        disabled={!confirm}
        loading={set.isPending}
        onClick={() => set.mutate(true, { onSuccess: () => toast.success(t("acceptedToast")) })}
      >
        {t("accept")}
      </Button>
    </div>
  );
}
