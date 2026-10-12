"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { channelKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Switch } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

type Settings = Schemas["MessagingSettings"];

/** Agency messaging switches: pause everything (kill switch), and whether automated replies meet the SLA. */
export function MessagingSettings() {
  const t = useTranslations("settings.messaging");
  const qc = useQueryClient();
  const canManage = useCan("integration.manage");
  const q = useQuery({ queryKey: channelKeys.settings, queryFn: () => unwrap(api.GET("/v1/messaging/settings")) });
  const save = useMutation({
    mutationFn: (body: Settings) => unwrap(api.PUT("/v1/messaging/settings", { body })),
    onSuccess: (s) => {
      qc.setQueryData(channelKeys.settings, s);
      track("messaging.settings_updated", s);
      toast.success(t(s.paused ? "pausedToast" : "savedToast"));
    },
  });
  if (q.isPending || !q.data) return <Skeleton className="h-40 w-full" />;
  const s = q.data;
  const row = (key: keyof Settings, danger = false) => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={`msg-${key}`} className={`text-sm font-medium ${danger && s[key] ? "text-danger" : ""}`}>
          {t(`${key}.label`)}
        </label>
        <p className="text-muted text-sm">{t(`${key}.hint`)}</p>
      </div>
      <Switch
        id={`msg-${key}`}
        checked={s[key]}
        disabled={!canManage || save.isPending}
        onCheckedChange={(on) => save.mutate({ ...s, [key]: on })}
      />
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {row("paused", true)}
        {row("auto_reply_counts_sla")}
      </CardContent>
    </Card>
  );
}
