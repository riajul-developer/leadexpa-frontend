import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CLIENT_TABS, ClientDetail, type ClientTab } from "@/features/clients";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("clients") };
}

export default async function Page({ params }: { params: Promise<{ clientId: string; tab?: string[] }> }) {
  const { clientId, tab } = await params;
  const name = (tab?.[0] ?? "overview") as ClientTab;
  if (!CLIENT_TABS.includes(name) || (tab && tab.length > 1)) notFound();
  return <ClientDetail clientId={clientId} tab={name} />;
}
