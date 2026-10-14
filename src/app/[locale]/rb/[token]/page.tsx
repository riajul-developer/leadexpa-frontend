import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PublicBuiltReportPage } from "@/features/reportbuilder/public-report";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reportBuilder.public" });
  // The token is the credential: never indexed, never leaked in a Referer.
  return { title: t("metaTitle"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Suspense>
      <PublicBuiltReportPage token={token} />
    </Suspense>
  );
}
