import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthShell } from "@/features/auth";
import { SSOCallback } from "@/features/sso";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.sso" });
  return { title: t("title"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.sso" });
  return (
    <AuthShell title={t("title")}>
      <Suspense>
        <SSOCallback />
      </Suspense>
    </AuthShell>
  );
}
