import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PartnersPage } from "@/features/partners";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("partners") };
}

export default function Page() {
  return <PartnersPage />;
}
