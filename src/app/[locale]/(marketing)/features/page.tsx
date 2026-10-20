import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FeaturesPage, SiteFooter, SiteHeader } from "@/features/marketing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  return { title: t("featuresTitle"), description: t("featuresDescription") };
}

export default async function Features({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader path="/features" />
      <FeaturesPage />
      <SiteFooter path="/features" />
    </>
  );
}
