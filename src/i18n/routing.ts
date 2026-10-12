import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "@/shared/config/locales";

export const locales = LOCALES;
export type Locale = AppLocale;

// Accept-Language decides on a first visit; the URL prefix is the source of truth afterwards.
export const routing = defineRouting({ locales, defaultLocale: DEFAULT_LOCALE, localePrefix: "always" });
