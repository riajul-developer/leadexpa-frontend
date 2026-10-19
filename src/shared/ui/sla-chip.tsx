"use client";

import { AlarmClock, CalendarClock, CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

import { useFormat } from "../hooks/use-format";
import { cn } from "../lib/cn";
import { useDisplayTimeZone } from "../lib/preferences";
import { needsFineTick, slaView, useNow, type SlaInput, type SlaState } from "../lib/sla";

const STYLE: Record<Exclude<SlaState, "none">, { cls: string; Icon: typeof Clock }> = {
  on_track: { cls: "bg-sla-on-track-soft text-sla-on-track", Icon: Clock },
  due_soon: { cls: "bg-sla-due-soon-soft text-sla-due-soon motion-safe:animate-sla-pulse", Icon: AlarmClock },
  overdue: { cls: "bg-sla-overdue-soft text-sla-overdue", Icon: TriangleAlert },
  met: { cls: "bg-sla-met-soft text-sla-met", Icon: CheckCircle2 },
  paused: { cls: "bg-sla-paused-soft text-sla-paused", Icon: CalendarClock },
};

/** Color, icon and text, never color alone. */
export const SlaChip = memo(function SlaChip({
  lead,
  timeZone,
  live = false,
  className,
}: {
  lead: SlaInput;
  timeZone?: string;
  live?: boolean;
  className?: string;
}) {
  const t = useTranslations("sla");
  const f = useFormat();
  const defaultTz = useDisplayTimeZone();
  const coarse = useNow(false);
  const fine = needsFineTick(slaView(lead, coarse || Date.now()));
  const now = useNow(fine);
  const v = slaView(lead, now || coarse || Date.now());
  if (v.state === "none") return null;
  const { cls, Icon } = STYLE[v.state];
  const d = f.duration(v.seconds);
  const label =
    v.state === "on_track" || v.state === "due_soon"
      ? t("left", { d })
      : v.state === "overdue"
        ? t("overdue", { d })
        : v.state === "met"
          ? t("met", { d })
          : t("callback", { time: f.dateTime(v.at ?? new Date(), timeZone ?? defaultTz, "short") });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
        cls,
        className,
      )}
      title={t(`state.${v.state}`)}
      aria-live={live ? "polite" : undefined}
      data-sla={v.state}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{t(`state.${v.state}`)}: </span>
      {label}
    </span>
  );
});
