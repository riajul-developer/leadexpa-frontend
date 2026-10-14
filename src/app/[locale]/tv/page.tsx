import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TvPage } from "@/features/wallboard/tv-page";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wallboard.tv" });
  return { title: t("metaTitle"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export default function Page() {
  return <TvPage />;
}
