import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PortalHome } from "@/features/portal";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portal" });
  return { title: t("metaHome"), robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <PortalHome />
    </Suspense>
  );
}
