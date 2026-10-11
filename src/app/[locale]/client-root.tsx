import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { Providers } from "../providers";

type Params = Promise<{ locale: string }>;

/**
 * Client-side runtime (i18n, React Query, toasts, plan-limit dialog) for the route groups that need it.
 * Not in the root layout: the public shared report is server-rendered and ships none of this.
 * `namespaces` limits the messages serialized to the browser (the full catalog is ~1k strings).
 * The locale comes from the route params: layouts render in parallel during static prerender, so relying on
 * the root layout's setRequestLocale would fall back to the default locale (every /en page rendered in bn).
 */
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
