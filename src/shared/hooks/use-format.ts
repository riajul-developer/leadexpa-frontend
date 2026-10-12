"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import * as f from "../lib/format";
import { usePreferences } from "../lib/preferences";

/** Formatting bound to the current locale and the user's display preferences (digits, clock, region). */
export function useFormat() {
  const locale = useLocale() as f.AppLocale;
  const digits = usePreferences((s) => s.digits);
  const hourCycle = usePreferences((s) => s.hourCycle);
  const region = usePreferences((s) => s.region);
  const t = useTranslations("units");
  return useMemo(() => {
    const o: f.FormatOptions = { locale, digits, region, hourCycle };
    const units = { d: t("d"), h: t("h"), m: t("m"), s: t("s") };
    return {
      options: o,
      number: (n: number, opts?: Intl.NumberFormatOptions) => f.formatNumber(n, o, opts),
      percent: (r: number | null | undefined, d?: number) => f.formatPercent(r, o, d),
      money: (m: Parameters<typeof f.formatMoney>[0]) => f.formatMoney(m, o),
      dateTime: (iso: string | Date, tz: string, style?: Parameters<typeof f.formatDateTime>[3]) =>
        f.formatDateTime(iso, tz, o, style),
      relative: (iso: string | Date, now: number) => f.formatRelative(iso, now, o),
      duration: (seconds: number) => f.formatDuration(seconds, o, units),
      phone: f.formatPhone,
    };
  }, [locale, digits, region, hourCycle, t]);
}
