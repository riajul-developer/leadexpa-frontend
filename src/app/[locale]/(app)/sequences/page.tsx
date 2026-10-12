import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SequencesPage } from "@/features/sequences";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("sequences") };
}

export default function Page() {
  return <SequencesPage />;
}
