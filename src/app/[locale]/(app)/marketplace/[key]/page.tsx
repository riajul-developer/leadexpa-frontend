import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ListingPage } from "@/features/marketplace";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("marketplace") };
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <ListingPage listingKey={key} />;
}
