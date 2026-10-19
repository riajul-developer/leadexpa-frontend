"use client";

import { useEffect, useState } from "react";

import { captureError } from "@/shared/lib/monitoring";

import "./globals.css";

// Replaces the root layout (no i18n provider), so strings are inlined.
const COPY = {
  bn: { title: "কিছু একটা ভুল হয়েছে", retry: "আবার চেষ্টা করুন", reference: "রেফারেন্স:" },
  en: { title: "Something went wrong", retry: "Try again", reference: "Reference:" },
} as const;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [eventId, setEventId] = useState<string>();
  const [locale, setLocale] = useState<keyof typeof COPY>("bn");

  useEffect(() => {
    if (window.location.pathname.startsWith("/en")) setLocale("en");
    void captureError(error, { boundary: "global" }).then(setEventId);
  }, [error]);

  const copy = COPY[locale];
  const reference = eventId ?? error.digest;
  return (
    <html lang={locale}>
      <body>
        <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-lg font-semibold">{copy.title}</h1>
          <button
            type="button"
            onClick={() => (reset ? reset() : window.location.reload())}
            className="bg-primary text-primary-fg h-10 rounded-lg px-4 text-sm font-medium"
          >
            {copy.retry}
          </button>
          {reference && (
            <p className="text-muted text-xs">
              {copy.reference} <code className="select-all">{reference}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
