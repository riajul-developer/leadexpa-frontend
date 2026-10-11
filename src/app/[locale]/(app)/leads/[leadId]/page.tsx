import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LeadPage } from "./lead-page";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leadDetail" });
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadPage leadId={leadId} />;
}
