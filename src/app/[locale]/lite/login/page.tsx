import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LiteLogin } from "@/features/lite";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lite.login" });
  return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <LiteLogin returnTo={returnTo} />;
}
