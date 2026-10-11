import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LeadsTableWithSheet } from "./leads-table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("leads") };
}

export default function Page() {
  return (
    <Suspense>
      <LeadsTableWithSheet />
    </Suspense>
  );
}
