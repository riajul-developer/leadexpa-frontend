import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ActionLinkPage } from "@/features/action-link";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "actionLink" });
  // The token is the credential: never indexed, never leaked in a Referer.
  return { title: t("title"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ActionLinkPage token={token} />;
}
