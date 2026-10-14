import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { MockGate } from "../../mock-gate";

/**
 * The wallboard TV (8h): paired by a kiosk token, no login. Only its own strings and the mock gate: no query
 * client, toasts or app shell, because TVs and streaming sticks are slow.
 */
export default async function TvLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const all = (await getMessages({ locale })) as { wallboard: { tv: Record<string, string> } };
  return (
    <NextIntlClientProvider locale={locale} messages={{ wallboard: { tv: all.wallboard.tv } }}>
      <MockGate>{children}</MockGate>
    </NextIntlClientProvider>
  );
}
