"use client";

// Loaded lazily (next/dynamic) so Recharts never ships with other routes.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useFormat } from "@/shared/hooks/use-format";

/** One metric across the breakdown: bars for clients/campaigns/agents, a line for days. */
export default function AskChart({
  rows,
  line,
  label,
  format,
}: {
  rows: { name: string; value: number }[];
  line: boolean;
  label: string;
  format: (v: number) => string;
}) {
  const f = useFormat();
  const tooltip = {
    contentStyle: { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 4 },
    formatter: (v: unknown) => [format(Number(v ?? 0)), label] as [string, string],
  };
  const axis = { fontSize: 12, tickFormatter: (v: number) => f.number(v, { notation: "compact" }) };
  return (
    <div className="h-56 w-full" dir="ltr" role="img" aria-label={label}>
      <ResponsiveContainer>
        {line ? (
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--c-border)" vertical={false} />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis {...axis} width={44} />
            <Tooltip {...tooltip} />
            <Line type="monotone" dataKey="value" stroke="var(--c-primary)" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--c-border)" vertical={false} />
            <XAxis
              dataKey="name"
              fontSize={12}
              interval={0}
              tickFormatter={(n: string) => (n.length > 14 ? n.slice(0, 13) + "…" : n)}
            />
            <YAxis {...axis} width={44} />
            <Tooltip {...tooltip} />
            <Bar dataKey="value" fill="var(--c-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
