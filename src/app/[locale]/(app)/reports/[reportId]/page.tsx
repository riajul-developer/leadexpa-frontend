import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ReportDetail } from "@/features/reports";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("reports") };
}

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <ReportDetail reportId={reportId} />;
}
