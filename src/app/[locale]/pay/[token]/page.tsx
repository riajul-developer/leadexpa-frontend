import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PayPage } from "@/features/paylinks";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "payPage" });
  // The token is the credential: never indexed, never leaked in a Referer.
  return { title: t("title"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Suspense>
      <PayPage token={token} />
    </Suspense>
  );
}
