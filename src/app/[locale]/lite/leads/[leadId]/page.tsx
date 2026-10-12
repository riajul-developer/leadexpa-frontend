import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LiteLead } from "@/features/lite";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lite" });
  return { title: t("myLeads"), robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LiteLead leadId={leadId} />;
}
