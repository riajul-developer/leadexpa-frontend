import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BuyPage } from "@/features/reseller";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "buyPage" });
  return { title: t("title"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <Suspense>
      <BuyPage code={code} />
    </Suspense>
  );
}
