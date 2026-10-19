"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { leadKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge, Skeleton } from "@/shared/ui/primitives";

type ConsentView = Schemas["ConsentView"];

const consentKey = (id: string) => [...leadKeys.all, "consents", id] as const;

/** Append-only; an any-channel opt-out blocks calls and messages everywhere. */
export function ConsentPanel({ leadId, timeZone }: { leadId: string; timeZone: string }) {
  const t = useTranslations("consent");
  const f = useFormat();
  const qc = useQueryClient();
  const canRecord = useCan("activity.create");
  const q = useQuery({
    queryKey: consentKey(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/consents", { params: { path: { leadId } } })),
  });
  const record = useMutation({
    mutationFn: (body: { channel: "any" | "whatsapp"; scope: "contact"; granted: boolean; note?: string }) =>
      unwrap(api.POST("/v1/leads/{leadId}/consents", { params: { path: { leadId } }, body })),
    onSuccess: (view: ConsentView, body) => {
      track("lead.consent.recorded", { channel: body.channel, granted: body.granted });
      qc.setQueryData(consentKey(leadId), view);
      void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId) });
      void qc.invalidateQueries({ queryKey: [...leadKeys.all, "contact-policy", leadId] });
      toast.success(body.granted ? t("recordedGranted") : t("recordedOptOut"));
    },
  });

  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  const view = q.data;
  if (!view) return null;
  const optedOut = view.state["any"]?.opted_out === true;
  const chips = Object.entries(view.state).flatMap(([channel, s]) => {
    const name = t.has(`channel.${channel}`) ? t(`channel.${channel}`) : channel;
    const out: { key: string; label: string; tone: "success" | "danger" | "neutral" }[] = [];
    if (s.opted_out) out.push({ key: channel + "-out", label: t("optedOut", { channel: name }), tone: "danger" });
    else if (s.contact) out.push({ key: channel + "-c", label: t("contactYes", { channel: name }), tone: "success" });
    if (s.marketing != null)
      out.push({
        key: channel + "-m",
        label: s.marketing ? t("marketingYes") : t("marketingNo"),
        tone: s.marketing ? "success" : "neutral",
      });
    return out;
  });

  return (
    <div className="grid gap-3">
      {chips.length === 0 ? (
        <p className="text-muted">{t("none")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Badge key={c.key} tone={c.tone}>
              {c.label}
            </Badge>
          ))}
        </div>
      )}
      {view.history.length > 0 && (
        <ol className="grid gap-1 text-xs">
          {view.history.map((e, i) => (
            <li key={e.id + i} className="text-muted">
              {f.dateTime(e.captured_at, timeZone, "short")} · {t(`source.${e.source}`)} ·{" "}
              {t(e.granted ? "historyGranted" : "historyWithdrawn", {
                channel: t.has(`channel.${e.channel}`) ? t(`channel.${e.channel}`) : e.channel,
                scope: t(`scope.${e.scope}`),
              })}
              {typeof (e.evidence as { note?: string }).note === "string" && (e.evidence as { note: string }).note && (
                <> — “{(e.evidence as { note: string }).note}”</>
              )}
              {e.written && <span> · {t("written")}</span>}
            </li>
          ))}
        </ol>
      )}
      {canRecord && (
        <div className="flex flex-wrap gap-2">
          {optedOut ? (
            <Button
              size="sm"
              variant="secondary"
              loading={record.isPending}
              onClick={() => record.mutate({ channel: "any", scope: "contact", granted: true, note: t("noteRestore") })}
            >
              {t("allowAgain")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              loading={record.isPending}
              onClick={() => {
                if (window.confirm(t("optOutConfirm")))
                  record.mutate({ channel: "any", scope: "contact", granted: false, note: t("noteOptOut") });
              }}
            >
              {t("optOut")}
            </Button>
          )}
          {!optedOut && view.state["whatsapp"]?.contact !== true && (
            <Button
              size="sm"
              variant="secondary"
              loading={record.isPending}
              onClick={() =>
                record.mutate({ channel: "whatsapp", scope: "contact", granted: true, note: t("noteWhatsApp") })
              }
            >
              {t("agreedWhatsApp")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function useContactPolicy(leadId: string) {
  return useQuery({
    queryKey: [...leadKeys.all, "contact-policy", leadId],
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/contact-policy", { params: { path: { leadId } } })),
    staleTime: 60_000,
    meta: { silent: true },
  });
}
