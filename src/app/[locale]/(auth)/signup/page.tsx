import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SignupForm } from "@/features/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signup" });
  return { title: t("title"), robots: { index: false } };
}

export default function Page() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
