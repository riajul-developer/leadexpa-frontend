import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

// Direct imports: the barrels also export client components.
// eslint-disable-next-line no-restricted-imports
import { BrandHeader, BrandTheme } from "@/features/portal/brand-theme";
// eslint-disable-next-line no-restricted-imports
import { ReportDocument } from "@/features/reports/components/report-document";
import { serverGet, type Report } from "@/shared/lib/server/api";

export const dynamic = "force-dynamic";

/** The renderer passes a short-lived ?token= that authorizes only this report. */
export default async function PrintReport({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reportId } = await params;
  const { token } = await searchParams;
  const report = token
    ? await serverGet<Report>(`/v1/print/reports/${encodeURIComponent(reportId)}`, { Authorization: `Bearer ${token}` })
    : null;
  if (!report?.snapshot) {
    // A non-2xx page makes the renderer fail instead of printing an error page.
    notFound();
  }
  setRequestLocale(report.locale);
  return (
    <BrandTheme brand={report.brand} className="">
      <main className="p-0">
        {report.brand && (
          <div className="mb-4">
            <BrandHeader brand={report.brand} />
          </div>
        )}
        <ReportDocument snapshot={report.snapshot} title={report.title} locale={report.locale} print />
      </main>
    </BrandTheme>
  );
}
