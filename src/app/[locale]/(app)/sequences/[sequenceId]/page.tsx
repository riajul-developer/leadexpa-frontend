import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SequenceDetail } from "@/features/sequences";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("sequences") };
}

export default async function Page({ params }: { params: Promise<{ sequenceId: string }> }) {
  const { sequenceId } = await params;
  return (
    <Suspense>
      <SequenceDetail id={sequenceId} />
    </Suspense>
  );
}
