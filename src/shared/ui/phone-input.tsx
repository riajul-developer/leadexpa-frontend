"use client";

import { useLocale } from "next-intl";
import * as React from "react";

import { countryOptions, DIAL_CODES } from "../config/countries";
import { cn } from "../lib/cn";

import { Input, NativeSelect } from "./input";

/**
 * Phone field with a country code picker (GLOBAL_PROMPT §5.2). The picker starts at the client's country;
 * combine the parts with composePhone() before sending. Digits in any script are accepted.
 */
export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    country: string;
    onCountryChange: (country: string) => void;
    countryLabel: string;
  }
>(({ country, onCountryChange, countryLabel, className, ...props }, ref) => {
  const locale = useLocale();
  const options = React.useMemo(() => countryOptions(locale).filter((o) => DIAL_CODES[o.code]), [locale]);
  return (
    <div className={cn("flex gap-2", className)} dir="ltr">
      {/* The list shows "BD +880 — Bangladesh"; the closed control only "BD +880", drawn over a transparent value. */}
      <div className="relative w-[6.75rem] shrink-0">
        <NativeSelect
          aria-label={countryLabel}
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          className="[&>option]:text-text text-transparent"
        >
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {`${o.code} +${DIAL_CODES[o.code]}`} — {o.name}
            </option>
          ))}
        </NativeSelect>
        <span
          aria-hidden
          className="text-text pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm tabular-nums"
        >
          {DIAL_CODES[country] ? `${country} +${DIAL_CODES[country]}` : country}
        </span>
      </div>
      <Input ref={ref} type="tel" inputMode="tel" autoComplete="off" className="flex-1" {...props} />
    </div>
  );
});
PhoneInput.displayName = "PhoneInput";
