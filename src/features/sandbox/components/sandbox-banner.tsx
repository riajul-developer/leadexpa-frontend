"use client";

import { FlaskConical, LogOut, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { track } from "@/shared/lib/analytics";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";

import { useAddTestLeads, useSandboxOf, useSwitchWorkspace } from "../api";

export function SandboxBanner() {
  const t = useTranslations("sandbox.banner");
  const liveId = useSandboxOf();
  const addLeads = useAddTestLeads();
  const back = useSwitchWorkspace();
  if (!liveId) return null;
  return (
    <div
      role="status"
      data-testid="sandbox-banner"
      className="bg-info-soft text-info flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <span className="me-auto">{t("text")}</span>
      <Button
        size="sm"
        variant="secondary"
        loading={addLeads.isPending}
        onClick={() =>
          addLeads.mutate(10, {
            onSuccess: (r) => {
              track("sandbox.leads_added", { count: r.created.length });
              toast.success(t("added", { count: r.created.length }));
            },
          })
        }
      >
        <UserPlus aria-hidden />
        {t("addLeads")}
      </Button>
      <Button size="sm" variant="ghost" loading={back.isPending} onClick={() => back.mutate(liveId)}>
        <LogOut className="rtl:-scale-x-100" aria-hidden />
        {t("back")}
      </Button>
    </div>
  );
}
