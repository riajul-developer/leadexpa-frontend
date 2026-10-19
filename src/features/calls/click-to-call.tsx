"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PhoneCall } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { leadKeys } from "@/shared/lib/query-keys";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";

import { FINAL, useCall, usePlaceCall, useVoiceNumbers } from "./api";
import { useCallErrorToast } from "./errors";
import { CallStatusBadge } from "./status";

export function ClickToCall({ lead }: { lead: { id: string; client_id: string } }) {
  const t = useTranslations("calls");
  const qc = useQueryClient();
  const numbers = useVoiceNumbers(lead.client_id);
  const place = usePlaceCall(lead.id);
  const fail = useCallErrorToast();
  const [callId, setCallId] = useState<string | null>(null);
  const call = useCall(callId);
  const status = call.data?.status;
  const ended = !!status && FINAL.has(status);
  useEffect(() => {
    if (!ended) return;
    void qc.invalidateQueries({ queryKey: leadKeys.activities(lead.id) });
    void qc.invalidateQueries({ queryKey: leadKeys.detail(lead.id) });
  }, [ended, qc, lead.id]);

  const twilio = numbers.data?.data.find((n) => n.provider === "twilio" && n.status === "active");
  if (!twilio) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={place.isPending}
        disabled={!!callId && !ended}
        onClick={() =>
          place.mutate(undefined, {
            onSuccess: (c) => {
              setCallId(c.id);
              toast.success(t("ringing"), { action: <Link href={`/calls?c=${c.id}`}>{t("open")}</Link> });
            },
            onError: fail,
          })
        }
      >
        <PhoneCall aria-hidden />
        {t("callVia", { number: twilio.number })}
      </Button>
      {status && (
        <span aria-live="polite">
          <CallStatusBadge status={status} />
        </span>
      )}
    </span>
  );
}
