"use client";

import { useMutation } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrapEmpty } from "@/shared/lib/api/client";
import { toast } from "@/shared/lib/toast";
import { ScoreBadge, useScoreFactor } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import type { Lead } from "../api/queries";

/** The lead's score with "Why?" in plain language, and "Score seems wrong" feedback (17.7). */
export function ScoreWhy({ lead }: { lead: Lead }) {
  const t = useTranslations("score");
  const factor = useScoreFactor();
  const [open, setOpen] = useState(false);
  const feedback = useMutation({
    mutationFn: (direction: "too_high" | "too_low") =>
      unwrapEmpty(
        api.POST("/v1/leads/{leadId}/score-feedback", { params: { path: { leadId: lead.id } }, body: { direction } }),
      ),
    onSuccess: (_, direction) => {
      track("score.feedback", { direction });
      toast.success(t("thanks"));
      setOpen(false);
    },
  });
  const s = lead.score;
  if (!s) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full" aria-label={t("why", { score: s.value })}>
          <ScoreBadge score={s} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="grid gap-3">
        <div>
          <p className="font-medium">{t("title", { score: s.value, band: t(`band.${s.band}`) })}</p>
          <p className="text-muted text-xs">{t("hint")}</p>
        </div>
        {s.factors.length > 0 ? (
          <ul className="grid gap-1.5 text-sm">
            {s.factors.map((f) => (
              <li key={f.feature} className="flex items-start gap-2">
                {f.effect >= 0 ? (
                  <ThumbsUp className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <ThumbsDown className="text-danger mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                {factor(f)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t("noFactors")}</p>
        )}
        <div className="border-border grid gap-2 border-t pt-3">
          <p className="text-muted text-xs">{t("wrong")}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={feedback.isPending && feedback.variables === "too_high"}
              onClick={() => feedback.mutate("too_high")}
            >
              {t("tooHigh")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={feedback.isPending && feedback.variables === "too_low"}
              onClick={() => feedback.mutate("too_low")}
            >
              {t("tooLow")}
            </Button>
          </div>
        </div>
        <p className="text-muted text-[11px]">{t("model", { version: s.version })}</p>
      </PopoverContent>
    </Popover>
  );
}
