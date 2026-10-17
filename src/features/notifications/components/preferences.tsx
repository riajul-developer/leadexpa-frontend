"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { usePreferences } from "@/shared/lib/preferences";
import { notificationKeys } from "@/shared/lib/query-keys";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Checkbox, Switch } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

type Prefs = Schemas["NotificationPreferences"];

/** Event × channel matrix, quiet hours, digest time; plus device settings (browser alerts, sound). */
export function NotificationPreferences() {
  const t = useTranslations("notifications.prefs");
  const tt = useTranslations("notifications.type");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: notificationKeys.prefs,
    queryFn: () => unwrap(api.GET("/v1/notification-preferences")),
  });
  const [draft, setDraft] = useState<Prefs | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: (p: Prefs) => unwrap(api.PUT("/v1/notification-preferences", { body: p })),
    onSuccess: (p) => {
      qc.setQueryData(notificationKeys.prefs, p);
      toast.success(t("saved"));
    },
  });

  const { slaSound, setSlaSound } = usePreferences();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  if (!draft) return <Skeleton className="h-80 w-full" />;
  const setEvent = (i: number, k: "in_app" | "email", v: boolean) =>
    setDraft({ ...draft, events: draft.events.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("matrix")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-start">
                <th scope="col" className="py-2 text-start font-medium">
                  {t("event")}
                </th>
                <th scope="col" className="w-20 py-2 text-center font-medium">
                  {t("inApp")}
                </th>
                <th scope="col" className="w-20 py-2 text-center font-medium">
                  {t("email")}
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.events.map((e, i) => (
                <tr key={e.event_type} className="border-border border-t">
                  <th scope="row" className="py-2.5 text-start font-normal">
                    {tt(e.event_type)}
                  </th>
                  <td className="text-center">
                    <Checkbox
                      className="mx-auto"
                      checked={e.in_app}
                      onCheckedChange={(v) => setEvent(i, "in_app", v === true)}
                      aria-label={`${tt(e.event_type)} · ${t("inApp")}`}
                    />
                  </td>
                  <td className="text-center">
                    <Checkbox
                      className="mx-auto"
                      checked={e.email}
                      onCheckedChange={(v) => setEvent(i, "email", v === true)}
                      aria-label={`${tt(e.event_type)} · ${t("email")}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={t("quietStart")} hint={t("quietHint")}>
              <Input
                type="time"
                value={draft.quiet_start ?? ""}
                onChange={(e) => setDraft({ ...draft, quiet_start: e.target.value || null })}
              />
            </Field>
            <Field label={t("quietEnd")}>
              <Input
                type="time"
                value={draft.quiet_end ?? ""}
                onChange={(e) => setDraft({ ...draft, quiet_end: e.target.value || null })}
              />
            </Field>
            <Field label={t("digestHour")}>
              <NativeSelect
                value={draft.digest_hour}
                onChange={(e) => setDraft({ ...draft, digest_hour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => save.mutate(draft)} loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("device")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("browser")}</p>
              <p className="text-muted text-sm">{t(`browserState.${permission}`)}</p>
            </div>
            {permission === "default" && (
              <Button variant="secondary" onClick={() => void Notification.requestPermission().then(setPermission)}>
                {t("enable")}
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="sla-sound" className="text-sm font-medium">
              {t("sound")}
            </label>
            <Switch id="sla-sound" checked={slaSound} onCheckedChange={setSlaSound} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
