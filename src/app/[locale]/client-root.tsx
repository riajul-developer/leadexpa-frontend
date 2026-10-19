import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { Providers } from "../providers";

type Params = Promise<{ locale: string }>;

/** Locale comes from params: parallel prerender would fall back to the default. */
export async function ClientRoot({
  children,
  params,
  namespaces,
}: {
  children: React.ReactNode;
  params: Params;
  namespaces?: string[];
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const all = await getMessages({ locale });
  const messages = namespaces ? Object.fromEntries(Object.entries(all).filter(([k]) => namespaces.includes(k))) : all;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}
