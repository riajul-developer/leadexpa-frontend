import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ReportBuilderPage } from "@/features/reportbuilder";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("reportBuilder") };
}

export default function Page() {
  return (
    <Suspense>
      <ReportBuilderPage />
    </Suspense>
  );
}
