"use client";

import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneCall, SkipForward } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap } from "@/shared/lib/api/client";
import { inboxKeys } from "@/shared/lib/query-keys";
import { StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { FINAL, useCall, useMyCallPhone, usePlaceCall } from "./api";
import { useCallErrorToast } from "./errors";
import { CallStatusBadge } from "./status";

const CALLABLE = new Set(["overdue", "due_soon", "callback_due", "new", "unassigned"]);

export function Dialer() {
  const t = useTranslations("calls.dialer");
  const client = useActiveClient();
  const phone = useMyCallPhone();
  const queue = useQuery({
    queryKey: [...inboxKeys.all, "dialer"],
    queryFn: () => unwrap(api.GET("/v1/inbox", { params: { query: { limit: 100 } } })),
  });
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());

  if (queue.isPending || phone.isPending) return <Skeleton className="m-4 h-48" />;
  if (!phone.data?.phone) {
    return (
      <EmptyState
        icon={Phone}
        title={t("noPhone")}
        description={t("noPhoneHint")}
        action={
          <Button asChild size="sm">
            <Link href="/settings/calls">{t("setPhone")}</Link>
          </Button>
        }
      />
    );
  }
  const leads = (queue.data?.data ?? []).filter(
    (l) =>
      CALLABLE.has(l.section) && l.phone && !l.do_not_contact && !done.has(l.id) && (!client || l.client_id === client),
  );
  const lead = leads[Math.min(index, leads.length - 1)];
  if (!lead) return <EmptyState icon={PhoneCall} title={t("empty")} description={t("emptyHint")} />;
  const next = () => {
    setDone((d) => new Set(d).add(lead.id));
    setIndex(0);
  };
  return (
    <div className="mx-auto grid max-w-xl gap-4 p-4">
      <p className="text-muted text-sm" aria-live="polite">
        {t("remaining", { count: leads.length })}
      </p>
      <DialerCard key={lead.id} lead={lead} onNext={next} onSkip={() => setIndex((i) => (i + 1) % leads.length)} />
    </div>
  );
}

type QueueLead = {
  id: string;
  full_name: string | null;
  phone: { e164: string; display: string } | null;
  stage: Parameters<typeof StageBadge>[0]["stage"];
  section: string;
  received_at: string;
};

function DialerCard({ lead, onNext, onSkip }: { lead: QueueLead; onNext: () => void; onSkip: () => void }) {
  const t = useTranslations("calls.dialer");
  const ti = useTranslations("calls");
  const f = useFormat();
  const place = usePlaceCall(lead.id);
  const fail = useCallErrorToast();
  const [callId, setCallId] = useState<string | null>(null);
  const call = useCall(callId);
  const finished = !!call.data && FINAL.has(call.data.status);
  return (
    <Card>
      <CardContent className="grid gap-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">
              <Link href={`/leads/${lead.id}`} className="hover:underline">
                {lead.full_name || lead.phone?.display}
              </Link>
            </h2>
            <p className="text-muted text-sm tabular-nums" dir="ltr">
              {lead.phone?.display}
            </p>
            <p className="text-muted text-sm">{t(`section.${lead.section}`)}</p>
          </div>
          <StageBadge stage={lead.stage} />
        </div>
        {call.data && (
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <CallStatusBadge status={call.data.status} />
            {!finished && <span className="text-muted">{ti("ringingHint")}</span>}
            {call.data.duration_seconds > 0 && <span>{f.duration(call.data.duration_seconds)}</span>}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onSkip} disabled={!!callId && !finished}>
            <SkipForward aria-hidden className="rtl:rotate-180" />
            {t("skip")}
          </Button>
          {finished ? (
            <Button onClick={onNext}>{t("next")}</Button>
          ) : (
            <Button
              onClick={() => place.mutate(undefined, { onSuccess: (c) => setCallId(c.id), onError: fail })}
              loading={place.isPending}
              disabled={!!callId}
            >
              <PhoneCall aria-hidden />
              {t("call")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
