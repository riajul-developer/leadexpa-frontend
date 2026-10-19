"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { localDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/primitives";

import type { Appointment, Slot } from "./api";

const STATUS_TONE = {
  booked: "info",
  confirmed: "success",
  cancelled: "neutral",
  attended: "success",
  no_show: "danger",
} as const;

export function AppointmentStatusBadge({ status }: { status: Appointment["status"] }) {
  const t = useTranslations("appointments.status");
  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}

export function RiskBadge({ appt }: { appt: Pick<Appointment, "risk_score" | "risk_factors" | "status"> }) {
  const t = useTranslations("appointments.risk");
  if (appt.risk_score < 60 || (appt.status !== "booked" && appt.status !== "confirmed")) return null;
  const why = appt.risk_factors.map((f) => (t.has(`factor.${f}`) ? t(`factor.${f}`) : f)).join(", ");
  return (
    <Badge tone="warning" title={why}>
      {t("high")}
    </Badge>
  );
}

export function SlotPicker({
  slots,
  timeZone,
  value,
  onChange,
  label,
}: {
  slots: Slot[];
  timeZone: string;
  value: string | null;
  onChange: (start: string) => void;
  label: string;
}) {
  const t = useTranslations("appointments.picker");
  const f = useFormat();
  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      const d = localDate(new Date(s.start), timeZone);
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots, timeZone]);
  const [day, setDay] = useState<string | null>(null);
  const active = day ?? days[0]?.[0] ?? null;
  if (days.length === 0) return <p className="text-muted text-sm">{t("none")}</p>;
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label={t("days")} className="flex gap-2 overflow-x-auto pb-1">
        {days.map(([d, list]) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active === d}
            onClick={() => setDay(d)}
            className={cn(
              "border-border grid shrink-0 gap-0.5 rounded-xl border px-3 py-2 text-start",
              active === d ? "border-primary bg-primary-soft" : "hover:bg-surface-2",
            )}
          >
            <span className="text-sm font-medium">{f.dateTime(list[0]!.start, timeZone, "date")}</span>
            <span className="text-muted text-xs">{t("count", { count: list.length })}</span>
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(days.find(([d]) => d === active)?.[1] ?? []).map((s) => (
          <button
            key={s.start}
            type="button"
            role="radio"
            aria-checked={value === s.start}
            onClick={() => onChange(s.start)}
            className={cn(
              "border-border rounded-lg border px-2 py-2.5 text-sm font-medium tabular-nums",
              value === s.start ? "border-primary bg-primary text-primary-fg" : "hover:bg-surface-2",
            )}
          >
            {f.dateTime(s.start, timeZone, "time")}
          </button>
        ))}
      </div>
    </div>
  );
}
