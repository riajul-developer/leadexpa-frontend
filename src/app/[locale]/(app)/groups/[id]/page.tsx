import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GroupPage } from "@/features/groups";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("holdingGroups") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupPage id={id} />;
}
