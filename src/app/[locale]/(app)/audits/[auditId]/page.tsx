import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuditDetail } from "@/features/revintel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("audits") };
}

export default async function Page({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  return <AuditDetail id={auditId} />;
}
