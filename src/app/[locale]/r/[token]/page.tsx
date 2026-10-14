import { Download, FileX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

// Direct imports: the barrels also export client components, which would ship to this server page.
// eslint-disable-next-line no-restricted-imports
import { BrandHeader, BrandTheme } from "@/features/portal/brand-theme";
// eslint-disable-next-line no-restricted-imports
import { ReportDocument } from "@/features/reports/components/report-document";
import { publicApiUrl, serverGet, type PublicReport } from "@/shared/lib/server/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "report" });
  // Shared reports are private to whoever holds the link.
  return { title: t("publicTitle"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

/** Public shared client report: server-rendered, no app shell, no session, mobile-first. */
export default async function SharedReport({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const report = await serverGet<PublicReport>(`/v1/public/reports/${encodeURIComponent(token)}`);
  // Content follows the report's language (chosen per report), whatever the URL locale.
  setRequestLocale(report?.locale ?? locale);
  const t = await getTranslations({ locale: report?.locale ?? locale, namespace: "report" });
  if (!report) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <FileX className="text-muted size-12" aria-hidden />
        <h1 className="text-xl font-semibold">{t("invalidLink")}</h1>
        <p className="text-muted max-w-sm text-sm">{t("invalidLinkHint")}</p>
      </main>
    );
  }
  return (
    <BrandTheme brand={report.brand ?? undefined}>
      <main className="px-4 py-6 sm:py-10">
        <div className="mx-auto mb-4 flex max-w-3xl items-start justify-between gap-3">
          {report.brand ? <BrandHeader brand={report.brand} /> : <span />}
          {report.pdf_available && (
            <a
              href={`${publicApiUrl}/v1/public/reports/${encodeURIComponent(token)}/pdf`}
              className="border-border bg-surface inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              <Download className="size-4" aria-hidden />
              {t("downloadPdf")}
            </a>
          )}
        </div>
        <div className="rounded-card border-border bg-surface shadow-card mx-auto max-w-3xl border p-5 sm:p-8">
          <ReportDocument snapshot={report.snapshot} title={report.title} locale={report.locale} />
        </div>
      </main>
    </BrandTheme>
  );
}
