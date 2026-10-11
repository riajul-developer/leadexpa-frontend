import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MetaIntegration } from "@/features/integrations";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("integrations") };
}

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <MetaIntegration />
    </div>
  );
}
