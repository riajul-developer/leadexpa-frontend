"use client";

import { useLocale } from "next-intl";
import * as React from "react";

import { parseMoney } from "../lib/format";

import { Input } from "./input";

function currencySymbol(currency: string, locale: string): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    currency: string;
    onValueChange: (text: string, minor: number | null) => void;
  }
>(({ value, currency, onValueChange, ...props }, ref) => {
  const locale = useLocale();
  const symbol = React.useMemo(() => currencySymbol(currency, locale), [currency, locale]);
  return (
    <div className="relative">
      <span className="text-muted pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm">
        {symbol}
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={symbol.length > 2 ? "ps-14 tabular-nums" : "ps-10 tabular-nums"}
        value={value}
        onChange={(e) => onValueChange(e.target.value, parseMoney(e.target.value, currency))}
        {...props}
      />
    </div>
  );
});
MoneyInput.displayName = "MoneyInput";
