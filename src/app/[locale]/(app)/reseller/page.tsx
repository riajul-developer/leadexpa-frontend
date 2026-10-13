import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ResellerPage } from "@/features/reseller";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("reseller") };
}

export default function Page() {
  return (
    <Suspense>
      <ResellerPage />
    </Suspense>
  );
}
