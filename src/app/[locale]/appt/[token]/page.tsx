import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ApptPage } from "@/features/appointments";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookPage" });
  // The token is the credential: never indexed, never leaked in a Referer.
  return { title: t("apptMetaTitle"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ booked?: string }>;
}) {
  const { token } = await params;
  const { booked } = await searchParams;
  return (
    <Suspense>
      <ApptPage token={token} booked={booked === "1"} />
    </Suspense>
  );
}
