import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ConnectorInstallPage } from "@/features/connectors";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("integrations") };
}

export default async function Page({ params }: { params: Promise<{ installId: string }> }) {
  const { installId } = await params;
  return (
    <div className="mx-auto max-w-4xl p-4">
      <Suspense>
        <ConnectorInstallPage id={installId} />
      </Suspense>
    </div>
  );
}
