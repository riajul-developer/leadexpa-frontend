"use client";

// Loaded lazily (next/dynamic) so Recharts never ships with other routes.
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useFormat } from "@/shared/hooks/use-format";
import type { Schemas } from "@/shared/lib/api/client";

type Row = Schemas["Breakdown"];

const axis = { stroke: "var(--c-muted)", fontSize: 12 };

export function LeadsChart({ rows }: { rows: Row[] }) {
  const t = useTranslations("dashboard.charts");
  const f = useFormat();
  const data = rows.map((r) => ({ day: r.day?.slice(5), leads: r.leads_received, won: r.leads_won }));
  return (
    <div className="h-64" role="img" aria-label={t("leadsOverTime")}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid stroke="var(--c-border)" vertical={false} />
          <XAxis dataKey="day" {...axis} />
          <YAxis width="auto" allowDecimals={false} {...axis} tickFormatter={(v: number) => f.number(v)} />
          <Tooltip
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 4 }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="leads"
            name={t("leads")}
            stroke="var(--c-primary)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="won"
            name={t("won")}
            stroke="var(--c-success)"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compliance by agent, sorted best first — coaching, not shaming (no red-only ranking). */
export function ComplianceChart({ rows }: { rows: Row[] }) {
  const t = useTranslations("dashboard.charts");
  const data = rows
    .filter((r) => r.sla_compliance != null)
    .map((r) => ({ name: r.name || t("unassigned"), compliance: Math.round((r.sla_compliance ?? 0) * 100) }))
    .sort((a, b) => b.compliance - a.compliance);
  if (data.length === 0) return <p className="text-muted py-16 text-center text-sm">{t("noData")}</p>;
  return (
    <div className="h-64" role="img" aria-label={t("complianceByAgent")}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
          <CartesianGrid stroke="var(--c-border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} unit="%" {...axis} />
          <YAxis type="category" dataKey="name" width="auto" {...axis} />
          <Tooltip
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 4 }}
          />
          <Bar
            dataKey="compliance"
            name={t("compliance")}
            fill="var(--c-accent)"
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
