// Supported UI languages (GLOBAL_PROMPT §5.2). Adding one = a messages/<locale>.json catalog + an entry here.
const BASE_LOCALES = ["en", "bn", "ar"] as const;

/**
 * en-XA is the generated pseudo-locale (scripts/pseudo-locale.mjs): accented, longer strings that expose
 * hard-coded text and truncation. Only builds with NEXT_PUBLIC_PSEUDO_LOCALE=1 (dev, E2E) route it.
 */
export type AppLocale = (typeof BASE_LOCALES)[number] | "en-XA";

export const LOCALES: readonly AppLocale[] =
  process.env.NEXT_PUBLIC_PSEUDO_LOCALE === "1" ? [...BASE_LOCALES, "en-XA"] : BASE_LOCALES;

/** First visit without a matching Accept-Language. */
export const DEFAULT_LOCALE: AppLocale = "en";

/** Each language's name in itself, for language pickers. */
export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: "English",
  bn: "বাংলা",
  ar: "العربية",
  "en-XA": "[Ƥşéúđó]",
};

const RTL = new Set<string>(["ar"]);

export function isRTL(locale: string): boolean {
  return RTL.has(locale);
}

export function dir(locale: string): "rtl" | "ltr" {
  return isRTL(locale) ? "rtl" : "ltr";
}

/** Locales that have their own digits; users choose Latin or native per the number_system preference. */
export const NATIVE_DIGITS: Partial<Record<AppLocale, string>> = { bn: "০১২৩৪৫৬৭৮৯", ar: "٠١٢٣٤٥٦٧٨٩" };

/** Intl numbering-system id of a locale's native digits. */
export const NATIVE_NUMBERING: Partial<Record<AppLocale, string>> = { bn: "beng", ar: "arab" };

/** BCP 47 tag for speech recognition (dictated call notes) per UI language. */
export const SPEECH_LANG: Partial<Record<AppLocale, string>> = { en: "en-US", bn: "bn-BD", ar: "ar-SA" };

/** Locales the API accepts (the pseudo-locale is a frontend test device and maps to English). */
export type ApiLocale = Exclude<AppLocale, "en-XA">;

export function toApiLocale(locale: string): ApiLocale {
  return (BASE_LOCALES as readonly string[]).includes(locale) ? (locale as ApiLocale) : "en";
}
