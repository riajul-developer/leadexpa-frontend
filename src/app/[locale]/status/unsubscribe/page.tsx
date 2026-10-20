import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SubscriptionLink } from "@/features/status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "serviceStatus.subscribe" });
  return { title: t("unsubscribe.title"), robots: { index: false } };
}

export default function Page() {
  return (
    <Suspense>
      <SubscriptionLink action="unsubscribe" />
    </Suspense>
  );
}
