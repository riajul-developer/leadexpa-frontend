"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { BrandHeader, BrandTheme } from "@/features/portal";
import { useFormat } from "@/shared/hooks/use-format";
import { api, type Schemas, unwrap } from "@/shared/lib/api/client";
import { Button } from "@/shared/ui/button";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { Skeleton } from "@/shared/ui/primitives";

import type { ReportWidget } from "./api";
import { Board } from "./board";
import { autoTitle, WidgetView } from "./widget-view";

type SnapshotWidget = ReportWidget & { metrics?: Schemas["AskMetricsResult"]; count?: number };

function Shell({ children, brand }: { children: React.ReactNode; brand?: Schemas["Brand"] | null }) {
  return (
    <BrandTheme brand={brand ?? undefined}>
      <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-5 px-4 py-8 print:py-0">
        <div className="flex items-start justify-between gap-3 print:hidden">
          {brand ? <BrandHeader brand={brand} /> : <span />}
          <LocaleSwitcher />
        </div>
        {children}
      </main>
    </BrandTheme>
  );
}

/** /rb/[token]: a shared custom report, frozen when it was created. Counts only: no leads, no internal ids. */
export function PublicBuiltReportPage({ token }: { token: string }) {
  const t = useTranslations("reportBuilder.public");
  const tb = useTranslations("reportBuilder");
  const ta = useTranslations("ask");
  const f = useFormat();
  const q = useQuery({
    queryKey: ["public-report-run", token],
    queryFn: () => unwrap(api.GET("/v1/public/report-runs/{token}", { params: { path: { token } } })),
    retry: false,
  });
  if (q.isPending)
    return (
      <Shell>
        <Skeleton className="h-96 w-full" />
      </Shell>
    );
  const r = q.data;
  if (!r)
    return (
      <Shell>
        <div className="grid justify-items-center gap-3 py-10 text-center">
          <XCircle className="text-danger size-10" aria-hidden />
          <h1 className="font-medium">{t("notFound")}</h1>
        </div>
      </Shell>
    );
  const widgets = (r.snapshot.widgets ?? []) as SnapshotWidget[];
  const day = (d: string) => f.dateTime(d + "T12:00:00Z", "UTC", "date");
  return (
    <Shell brand={r.brand}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-muted text-sm">{t("preparedBy", { agency: r.brand?.display_name ?? r.agency })}</p>
          <h1 className="text-2xl font-semibold">{r.name}</h1>
          <p className="text-muted text-sm">
            {r.client} · {day(r.period_from)} – {day(r.period_to)}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
          <Printer aria-hidden />
          {t("print")}
        </Button>
      </header>
      <Board
        widgets={widgets}
        label={r.name}
        title={(w) => autoTitle(ta, tb, w)}
        render={(w) => {
          const s = w as SnapshotWidget;
          return <WidgetView widget={w} data={{ metrics: s.metrics, count: s.count }} />;
        }}
      />
      <p className="text-muted text-xs">{t("frozen", { when: f.dateTime(r.created_at, "UTC", "date") })}</p>
    </Shell>
  );
}
