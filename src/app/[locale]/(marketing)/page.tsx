import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LandingPage, SiteFooter, SiteHeader } from "@/features/marketing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    openGraph: { title: t("title"), description: t("description") },
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader path="/" />
      <LandingPage />
      <SiteFooter path="/" />
    </>
  );
}
