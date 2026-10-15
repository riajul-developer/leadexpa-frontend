import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { MockGate } from "../../mock-gate";

/** The public status page (G7j): no login, no app shell; only its own strings and the mock gate. */
export default async function StatusLayout({
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
    <NextIntlClientProvider locale={locale} messages={{ serviceStatus: all.serviceStatus }}>
      <MockGate>{children}</MockGate>
    </NextIntlClientProvider>
  );
}
