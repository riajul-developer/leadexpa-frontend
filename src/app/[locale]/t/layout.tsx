import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { MockGate } from "../../mock-gate";

export default async function ActionLinkLayout({
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
    <NextIntlClientProvider locale={locale} messages={{ actionLink: all.actionLink }}>
      <MockGate>{children}</MockGate>
    </NextIntlClientProvider>
  );
}
