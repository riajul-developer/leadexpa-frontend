"use client";

import { useLocale } from "next-intl";
import * as React from "react";

import { countryOptions } from "../config/countries";
import { LOCALE_NAMES, LOCALES, type AppLocale } from "../config/locales";

import { NativeSelect } from "./input";

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "children">;

export function LocaleSelect({
  value,
  onValueChange,
  ...props
}: SelectProps & { value: string; onValueChange: (locale: AppLocale) => void }) {
  return (
    <NativeSelect {...props} value={value} onChange={(e) => onValueChange(e.target.value as AppLocale)}>
      {LOCALES.map((l) => (
        <option key={l} value={l} lang={l}>
          {LOCALE_NAMES[l]}
        </option>
      ))}
    </NativeSelect>
  );
}

export function CountrySelect({
  value,
  onValueChange,
  placeholder,
  ...props
}: SelectProps & { value: string; onValueChange: (country: string) => void; placeholder?: string }) {
  const locale = useLocale();
  const options = React.useMemo(() => countryOptions(locale), [locale]);
  return (
    <NativeSelect {...props} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {/* A value outside the curated list (set elsewhere) still shows. */}
      {value && !options.some((o) => o.code === value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function allZones(): string[] {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
}

export function TimeZoneSelect({
  value,
  onValueChange,
  ...props
}: SelectProps & { value: string; onValueChange: (tz: string) => void }) {
  const zones = React.useMemo(() => {
    const list = allZones();
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [value]);
  return (
    <NativeSelect {...props} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {zones.map((z) => (
        <option key={z} value={z}>
          {z.replace(/_/g, " ")}
        </option>
      ))}
    </NativeSelect>
  );
}
