import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ProgressPage } from "@/features/coaching";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("progress") };
}

export default function Page() {
  return (
    <Suspense>
      <ProgressPage />
    </Suspense>
  );
}
