"use client";

import { LayoutDashboard, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useDeleteTemplate, useTemplates } from "./api";
import { STARTERS, type Starter } from "./grid";

export function ReportBuilderPage() {
  const t = useTranslations("reportBuilder");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const canEdit = useCan("report.share");
  const list = useTemplates();
  const remove = useDeleteTemplate();
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="text-accent size-6" aria-hidden />
            {t("title")}
          </h1>
          <p className="text-muted max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/report-builder/new">
              <Plus aria-hidden />
              {t("newReport")}
            </Link>
          </Button>
        )}
      </header>

      <section aria-labelledby="rb-saved" className="grid gap-3">
        <h2 id="rb-saved" className="text-sm font-semibold">
          {t("saved")}
        </h2>
        {list.isPending ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={LayoutGrid}
              title={t("noTemplates")}
              description={canEdit ? t("noTemplatesHint") : undefined}
            />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Card className="hover:border-accent/40 relative h-full transition-colors">
                  <CardContent className="flex h-full flex-col gap-2 pt-4 pb-3">
                    <Link
                      href={`/report-builder/${r.id}`}
                      className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.description && <p className="text-muted line-clamp-2 text-sm">{r.description}</p>}
                    <p className="text-muted text-xs">
                      {t("widgetCount", { count: r.widgets.length })} ·{" "}
                      {t("updated", { when: f.dateTime(r.updated_at, tz, "date") })}
                    </p>
                    {canEdit && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted hover:text-danger relative z-10 mt-auto self-end"
                        aria-label={t("deleteNamed", { name: r.name })}
                        onClick={() =>
                          window.confirm(t("confirmDelete", { name: r.name })) &&
                          remove.mutate(r.id, { onSuccess: () => toast.success(t("deleted")) })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section aria-labelledby="rb-starters" className="grid gap-3">
          <h2 id="rb-starters" className="text-sm font-semibold">
            {t("startFrom")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(STARTERS) as Starter[]).map((k) => (
              <li key={k}>
                <Link
                  href={`/report-builder/new?starter=${k}`}
                  className="border-border bg-surface hover:border-accent/40 hover:bg-surface-2 grid h-full gap-2 rounded-xl border border-dashed p-4"
                >
                  <MiniLayout starter={k} />
                  <span className="font-medium">{t(`starters.${k}.name`)}</span>
                  <span className="text-muted text-sm">{t(`starters.${k}.description`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MiniLayout({ starter }: { starter: Starter }) {
  return (
    <div aria-hidden className="grid grid-cols-12 gap-0.5" style={{ gridAutoRows: "6px" }}>
      {STARTERS[starter].map((w, i) => (
        <div
          key={i}
          className={w.type === "kpi" ? "bg-accent/30 rounded-sm" : "bg-primary/20 rounded-sm"}
          style={{
            gridColumn: `${w.layout.x + 1} / span ${w.layout.w}`,
            gridRow: `${w.layout.y + 1} / span ${w.layout.h}`,
          }}
        />
      ))}
    </div>
  );
}
