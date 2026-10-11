import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export { ClientsList as default } from "@/features/clients";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("clients") };
}
