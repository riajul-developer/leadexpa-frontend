import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { MockGate } from "../../mock-gate";

export default async function LiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const all = await getMessages({ locale });
  return (
    <NextIntlClientProvider locale={locale} messages={{ lite: all.lite }}>
      <MockGate>{children}</MockGate>
    </NextIntlClientProvider>
  );
}
