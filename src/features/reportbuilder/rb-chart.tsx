"use client";

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

export const SERIES_COLORS = ["var(--c-primary)", "var(--c-accent)", "var(--c-info)"];

export type Series = { key: string; label: string; format: (v: number) => string };

export default function RbChart({
  rows,
  series,
  line,
  label,
}: {
  rows: Record<string, string | number | null>[];
  series: Series[];
  line: boolean;
  label: string;
}) {
  const f = useFormat();
  const horizontal = !line && rows.length > 6;
  const byKey = new Map(series.map((s) => [s.key, s]));
  const tooltip = {
    contentStyle: { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 4 },
    formatter: (v: unknown, key: unknown) => {
      const s = byKey.get(String(key));
      return [s ? s.format(Number(v ?? 0)) : String(v), s?.label ?? String(key)] as [string, string];
    },
  };
  const axis = { fontSize: 11, tickFormatter: (v: number) => f.number(v, { notation: "compact" }) };
  const legend = series.length > 1 && (
    <Legend
      iconSize={8}
      wrapperStyle={{ fontSize: 12 }}
      formatter={(key: unknown) => byKey.get(String(key))?.label ?? String(key)}
    />
  );
  const margin = { top: 4, right: 8, bottom: 0, left: 0 };
  const bars = series.map((s, i) => (
    <Bar
      key={s.key}
      dataKey={s.key}
      fill={SERIES_COLORS[i]}
      radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
      isAnimationActive={false}
    />
  ));
  if (horizontal) {
    const first = series[0]?.key ?? "";
    const sorted = [...rows].sort((a, b) => Number(b[first] ?? 0) - Number(a[first] ?? 0));
    const minHeight = sorted.length * (14 + 8 * series.length) + (legend ? 64 : 40);
    return (
      <div className="h-full w-full" style={{ minHeight }} dir="ltr" role="img" aria-label={label}>
        <ResponsiveContainer>
          <BarChart data={sorted} layout="vertical" margin={margin} barCategoryGap="15%">
            <CartesianGrid stroke="var(--c-border)" horizontal={false} />
            <XAxis type="number" {...axis} />
            <YAxis
              type="category"
              dataKey="name"
              fontSize={11}
              interval={0}
              width="auto"
              tickFormatter={(n: string) => (n.length > 20 ? n.slice(0, 19) + "…" : n)}
            />
            <Tooltip {...tooltip} cursor={{ fill: "var(--c-surface-2)" }} />
            {legend}
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="h-full min-h-0 w-full" dir="ltr" role="img" aria-label={label}>
      <ResponsiveContainer>
        {line ? (
          <LineChart data={rows} margin={margin}>
            <CartesianGrid stroke="var(--c-border)" vertical={false} />
            <XAxis dataKey="name" fontSize={11} minTickGap={16} />
            <YAxis {...axis} width="auto" />
            <Tooltip {...tooltip} />
            {legend}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={SERIES_COLORS[i]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={rows} margin={margin}>
            <CartesianGrid stroke="var(--c-border)" vertical={false} />
            <XAxis
              dataKey="name"
              fontSize={11}
              interval={0}
              tickFormatter={(n: string) => (n.length > 12 ? n.slice(0, 11) + "…" : n)}
            />
            <YAxis {...axis} width="auto" />
            <Tooltip {...tooltip} />
            {legend}
            {bars}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
