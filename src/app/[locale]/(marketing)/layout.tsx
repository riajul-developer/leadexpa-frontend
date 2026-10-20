import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { MarketingShell } from "@/features/marketing";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <MarketingShell>{children}</MarketingShell>
    </NextIntlClientProvider>
  );
}
