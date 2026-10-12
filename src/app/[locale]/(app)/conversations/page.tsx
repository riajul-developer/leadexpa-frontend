import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ConversationsPage } from "@/features/conversations";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("conversations") };
}

export default function Page() {
  return (
    <Suspense>
      <ConversationsPage />
    </Suspense>
  );
}
