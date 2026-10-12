"use client";

import { useMutation } from "@tanstack/react-query";
import { Copy, Link2, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import type { LeadDetail } from "../api/hooks";

/**
 * Action link (BACKEND_PROMPT 17.0.3): a 72-hour, no-login link for this one lead, for client staff who won't
 * open the app. It logs outcomes as the lead's owner; a new link or a reassignment kills the old one.
 */
export function ActionLinkShare({ lead, timeZone }: { lead: Pick<LeadDetail, "id" | "full_name">; timeZone: string }) {
  const t = useTranslations("actionLink");
  const locale = useLocale();
  const f = useFormat();
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/leads/{leadId}/action-link", { params: { path: { leadId: lead.id } } })),
    onSuccess: () => track("lead.action_link.created"),
  });
  const link = create.data;
  const url = link ? `${window.location.origin}/${locale}${link.path}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-muted text-xs">{t("shareHint")}</p>
      {!link ? (
        <Button
          variant="secondary"
          className="justify-self-start"
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          <Link2 className="size-4" aria-hidden />
          {t("create")}
        </Button>
      ) : (
        <div className="grid gap-2">
          <Input readOnly value={url} aria-label={t("linkLabel")} onFocus={(e) => e.currentTarget.select()} dir="ltr" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copy()}>
              <Copy className="size-4" aria-hidden />
              {t("copy")}
            </Button>
            <a
              className="border-border bg-surface inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
              href={`https://wa.me/?text=${encodeURIComponent(t("shareText", { name: lead.full_name || "—", url }))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Share2 className="size-4" aria-hidden />
              {t("shareWhatsApp")}
            </a>
            <span className="text-muted text-xs">{t("expires", { at: f.dateTime(link.expires_at, timeZone) })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
