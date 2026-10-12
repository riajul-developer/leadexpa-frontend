import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { MockGate } from "../../mock-gate";

/**
 * Action-link pages (no login): only their own strings and the mock gate. No query client, toasts or app
 * shell: the page adds ~13 KB on top of the framework, for a cheap phone on 3G.
 */
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
