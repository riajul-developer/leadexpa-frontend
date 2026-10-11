import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SETTINGS_TABS, SettingsPage, type SettingsTab } from "@/features/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("settings") };
}

export default async function Page({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!SETTINGS_TABS.includes(tab as SettingsTab)) notFound();
  return <SettingsPage tab={tab as SettingsTab} />;
}
