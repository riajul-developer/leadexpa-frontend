const BASE_LOCALES = ["en", "bn", "ar"] as const;

export type AppLocale = (typeof BASE_LOCALES)[number] | "en-XA";

export const LOCALES: readonly AppLocale[] =
  process.env.NEXT_PUBLIC_PSEUDO_LOCALE === "1" ? [...BASE_LOCALES, "en-XA"] : BASE_LOCALES;

export const DEFAULT_LOCALE: AppLocale = "en";

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

export const NATIVE_DIGITS: Partial<Record<AppLocale, string>> = { bn: "০১২৩৪৫৬৭৮৯", ar: "٠١٢٣٤٥٦٧٨٩" };

export const NATIVE_NUMBERING: Partial<Record<AppLocale, string>> = { bn: "beng", ar: "arab" };

export const SPEECH_LANG: Partial<Record<AppLocale, string>> = { en: "en-US", bn: "bn-BD", ar: "ar-SA" };

export type ApiLocale = Exclude<AppLocale, "en-XA">;

export function toApiLocale(locale: string): ApiLocale {
  return (BASE_LOCALES as readonly string[]).includes(locale) ? (locale as ApiLocale) : "en";
}
