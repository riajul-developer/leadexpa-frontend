import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StatusPage } from "@/features/status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "serviceStatus" });
  return { title: t("title"), description: t("subtitle") };
}

export default function Page() {
  return <StatusPage />;
}
