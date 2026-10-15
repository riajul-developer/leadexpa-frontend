"use client";

import { Languages } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";

import { LOCALE_NAMES, LOCALES, type AppLocale } from "../config/locales";
import { cn } from "../lib/cn";

/** Language picker for screens outside the app shell; keeps the current page and query. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className={cn("text-muted hover:text-text inline-flex items-center gap-1 text-sm", className)}>
      <Languages className="size-4" aria-hidden />
      <span className="sr-only">{t("switchLanguage")}</span>
      <select
        value={locale}
        className="select-chevron select-compact hover:text-text cursor-pointer rounded-sm bg-transparent"
        onChange={(e) => {
          const qs = params.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: e.target.value as AppLocale });
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
