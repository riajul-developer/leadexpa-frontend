"use client";

import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { useMembers } from "@/shared/lib/lookups";
import { NativeSelect } from "@/shared/ui/input";
import { Badge, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useCoaching } from "./api";

const RANGES = [7, 30, 90] as const;

/** Per-agent call coaching (17.8): connect rate, connected length, talk ratio and the objections they hear. */
export function Coaching() {
  const t = useTranslations("calls.coaching");
  const f = useFormat();
  const client = useActiveClient();
  const { byUserId } = useMembers();
  const [days, setDays] = useState<number>(30);
  const q = useCoaching(days, client ?? undefined);
  const rows = q.data?.data ?? [];
  return (
    <div className="grid gap-3 overflow-x-auto p-4">
      <div className="flex items-center gap-2">
        <p className="text-muted flex-1 text-sm">{t("hint")}</p>
        <NativeSelect
          aria-label={t("range")}
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-36"
        >
          {RANGES.map((d) => (
            <option key={d} value={d}>
              {t("lastDays", { days: d })}
            </option>
          ))}
        </NativeSelect>
      </div>
      {q.isPending ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("empty")} />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-muted text-start">
            <tr>
              <th className="py-2 text-start font-medium">{t("agent")}</th>
              <th className="py-2 text-end font-medium">{t("calls")}</th>
              <th className="py-2 text-end font-medium">{t("connectRate")}</th>
              <th className="py-2 text-end font-medium">{t("avgLength")}</th>
              <th className="py-2 text-end font-medium">{t("talkRatio")}</th>
              <th className="py-2 ps-4 text-start font-medium">{t("objections")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-border border-t">
                <td className="py-2">{byUserId.get(r.user_id)?.user.name ?? "—"}</td>
                <td className="py-2 text-end tabular-nums">{f.number(r.calls)}</td>
                <td className="py-2 text-end tabular-nums">{f.percent(r.calls ? r.connected / r.calls : null)}</td>
                <td className="py-2 text-end tabular-nums">
                  {r.avg_duration_seconds ? f.duration(r.avg_duration_seconds) : "—"}
                </td>
                <td className="py-2 text-end tabular-nums">{r.talk_ratio == null ? "—" : f.percent(r.talk_ratio)}</td>
                <td className="py-2 ps-4">
                  <span className="flex flex-wrap gap-1">
                    {r.top_objections.map((o) => (
                      <Badge key={o.text} tone="warning">
                        {o.text} · {f.number(o.count)}
                      </Badge>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
