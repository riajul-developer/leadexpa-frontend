import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";

import { startMocking } from "@/mocks/browser";
import { dir } from "@/shared/config/locales";

import ar from "../messages/ar.json";
import bn from "../messages/bn.json";
import en from "../messages/en.json";

import "../src/app/globals.css";

const MESSAGES = { bn, en, ar };
type StoryLocale = keyof typeof MESSAGES;

let mocking: Promise<void> | undefined;

/** Locale and the client runtime (React Query) the app's providers would give a component. */
function AppFrame({ locale, children }: { locale: StoryLocale; children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir(locale);
  }, [locale]);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Dhaka">
      <QueryClientProvider client={client}>
        <div className="bg-bg text-text min-h-dvh p-4">{children}</div>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

const withApp: Decorator = (Story, { globals }) => (
  <AppFrame locale={(globals.locale as StoryLocale) ?? "bn"}>
    <Story />
  </AppFrame>
);

const preview: Preview = {
  globalTypes: {
    locale: {
      description: "UI language",
      toolbar: {
        icon: "globe",
        items: [
          { value: "bn", title: "বাংলা" },
          { value: "en", title: "English" },
          { value: "ar", title: "العربية (RTL)" },
        ],
      },
    },
  },
  initialGlobals: { locale: "bn" },
  // Feature components fetch through the generated API client; MSW answers with the BD seed data.
  loaders: [() => (mocking ??= startMocking())],
  decorators: [withApp],
  parameters: {
    nextjs: { appDirectory: true },
    layout: "fullscreen",
    // Same bar as Playwright's axe checks (FRONTEND_PROMPT §10): violations fail the story's test.
    a11y: { test: "error" },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
