"use client";

import { useQuery } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { BrandHeader, BrandTheme } from "@/features/portal";
import { useFormat } from "@/shared/hooks/use-format";
import { api, type Schemas, unwrap } from "@/shared/lib/api/client";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { Skeleton } from "@/shared/ui/primitives";

import { AuditReportView } from "./audit-report";
import { ReviewDocument } from "./business-reviews";

function Shell({ children, brand }: { children: React.ReactNode; brand?: Schemas["Brand"] | null }) {
  return (
    <BrandTheme brand={brand ?? undefined}>
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 py-8">
        <div className="flex items-start justify-between gap-3">
          {brand ? <BrandHeader brand={brand} /> : <span />}
          <LocaleSwitcher />
        </div>
        {children}
      </main>
    </BrandTheme>
  );
}

function Gone({ title }: { title: string }) {
  return (
    <div className="grid justify-items-center gap-3 py-10 text-center">
      <XCircle className="text-danger size-10" aria-hidden />
      <h1 className="font-medium">{title}</h1>
    </div>
  );
}

export function PublicAuditPage({ token }: { token: string }) {
  const t = useTranslations("revintel.publicAudit");
  const q = useQuery({
    queryKey: ["public-audit", token],
    queryFn: () => unwrap(api.GET("/v1/public/audits/{token}", { params: { path: { token } } })),
    retry: false,
  });
  if (q.isPending)
    return (
      <Shell>
        <Skeleton className="h-96 w-full" />
      </Shell>
    );
  const a = q.data;
  if (!a)
    return (
      <Shell>
        <Gone title={t("notFound")} />
      </Shell>
    );
  return (
    <Shell brand={a.brand}>
      <header className="grid gap-1">
        <p className="text-muted text-sm">{t("preparedBy", { agency: a.brand?.display_name ?? a.agency })}</p>
        <h1 className="text-2xl font-semibold">{t("title", { prospect: a.prospect_name })}</h1>
        <p className="text-muted text-sm">{t("intro")}</p>
      </header>
      <AuditReportView report={a.report} currency={a.currency} industry={a.industry} />
    </Shell>
  );
}

export function PublicReviewPage({ token }: { token: string }) {
  const t = useTranslations("revintel.publicReview");
  const tr = useTranslations("revintel.review");
  const f = useFormat();
  const q = useQuery({
    queryKey: ["public-review", token],
    queryFn: () => unwrap(api.GET("/v1/public/business-reviews/{token}", { params: { path: { token } } })),
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
        <Gone title={t("notFound")} />
      </Shell>
    );
  const period = `${f.dateTime(r.review.period_from + "T12:00:00Z", "UTC", "date")} – ${f.dateTime(r.review.period_to + "T12:00:00Z", "UTC", "date")}`;
  return (
    <Shell brand={r.brand}>
      <header className="grid gap-1">
        <p className="text-muted text-sm">{t("preparedBy", { agency: r.brand?.display_name ?? r.agency })}</p>
        <h1 className="text-2xl font-semibold">{t("title", { client: r.client, kind: tr(r.review.kind) })}</h1>
        <p className="text-muted text-sm">{period}</p>
      </header>
      <ReviewDocument review={r.review} />
      <p className="text-muted text-xs">{tr("numbersHint")}</p>
    </Shell>
  );
}
