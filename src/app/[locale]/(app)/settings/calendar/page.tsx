import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsPage } from "@/features/settings";

// A static segment (its callback lives under it), so it can't fall through to [tab].
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("settings") };
}

export default function Page() {
  return <SettingsPage tab="calendar" />;
}
