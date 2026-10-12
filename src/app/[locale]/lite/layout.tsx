import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { MockGate } from "../../mock-gate";

/**
 * Lite app for client staff (FRONTEND_PROMPT 17.0.3): only its own strings and the mock gate. No query client,
 * toasts or app shell, for a cheap Android phone and the Facebook/WhatsApp in-app browsers.
 */
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
