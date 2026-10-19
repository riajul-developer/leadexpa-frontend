import { NATIVE_DIGITS, NATIVE_NUMBERING, type AppLocale } from "../../config/locales";

export type { AppLocale };
export type Digits = "latn" | "native";
export type HourCycle = "h12" | "h23";

export interface FormatOptions {
  locale: AppLocale;
  digits: Digits;
  region?: string | null;
  hourCycle?: HourCycle | null;
}

const NATIVE_RANGES: [RegExp, number][] = [
  [/[০-৯]/g, 0x09e6], // Bangla
  [/[٠-٩]/g, 0x0660], // Arabic-Indic
  [/[۰-۹]/g, 0x06f0], // Extended Arabic-Indic (Persian, Urdu)
  [/[०-९]/g, 0x0966], // Devanagari
];

export function toLatinDigits(s: string): string {
  let out = s;
  for (const [re, zero] of NATIVE_RANGES) out = out.replace(re, (d) => String(d.charCodeAt(0) - zero));
  return out;
}

export function toNativeDigits(s: string, locale: AppLocale): string {
  const digits = NATIVE_DIGITS[locale];
  return digits ? s.replace(/[0-9]/g, (d) => digits[Number(d)] ?? d) : s;
}

export function toBanglaDigits(s: string): string {
  return toNativeDigits(s, "bn");
}

export function intlLocale({ locale, digits, region, hourCycle }: FormatOptions): string {
  // Only the language subtag takes a region: en-XA + BD → en-BD, never en-XA-BD.
  const lang = locale.split("-")[0]!;
  const base = lang === "bn" ? "bn-BD" : region ? `${lang}-${region.toUpperCase()}` : lang === "ar" ? "ar" : "en-US";
  const ext: string[] = [];
  const native = NATIVE_NUMBERING[locale];
  if (native) ext.push(`nu-${digits === "native" ? native : "latn"}`);
  if (hourCycle) ext.push(`hc-${hourCycle}`);
  return ext.length ? `${base}-u-${ext.join("-")}` : base;
}

export function formatNumber(n: number, o: FormatOptions, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(o), opts).format(n);
}

export function formatPercent(ratio: number | null | undefined, o: FormatOptions, digits = 0): string {
  if (ratio == null) return "—";
  return formatNumber(ratio, o, { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits });
}

const EXPONENTS: Record<string, number> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function minorUnits(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

export function formatMoney(
  m: { amount_minor: number; currency: string } | null | undefined,
  o: FormatOptions,
): string {
  if (!m) return "—";
  const exp = minorUnits(m.currency);
  const value = m.amount_minor / 10 ** exp;
  const whole = Number.isInteger(value);
  const digits = { minimumFractionDigits: whole ? 0 : exp, maximumFractionDigits: exp };
  if (o.locale === "bn") {
    const num = formatNumber(value, o, digits);
    const symbol = m.currency === "BDT" ? "৳" : m.currency + " ";
    return value < 0 ? `-${symbol}${num.replace("-", "")}` : `${symbol}${num}`;
  }
  const text = formatNumber(value, o, {
    style: "currency",
    currency: m.currency,
    currencyDisplay: "symbol",
    ...digits,
  });
  return text.replace(/\u00a0/g, " ");
}

/** Parses money in any script into minor units; extra decimals are rejected, not rounded. */
export function parseMoney(input: string, currency: string): number | null {
  const cleaned = toLatinDigits(input)
    .replace(/٫/g, ".")
    .replace(/[٬,\s\u00a0]/g, "")
    .replace(/^[^\d.]+|[^\d.]+$/g, "");
  const exp = minorUnits(currency);
  const pattern = exp === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${exp}})?$`);
  if (!pattern.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 10 ** exp);
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const bd = e164.match(/^\+880(1[3-9]\d{8})$/);
  if (!bd) return e164;
  const n = bd[1]!;
  return `0${n.slice(0, 4)}-${n.slice(4)}`;
}

export function telHref(e164: string): string {
  return `tel:${e164}`;
}

export function whatsappHref(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function extractPhone(text: string): string | null {
  const latin = toLatinDigits(text);
  // Foreign codes first: the BD pattern could match digits in their middle.
  const intlFirst = latin.match(/\+[\s-]*\d(?:[\s().-]*\d){6,14}/);
  if (intlFirst && !/^\+[\s-]*8[\s-]*8/.test(intlFirst[0])) return "+" + intlFirst[0].replace(/\D/g, "");
  // Optional +88/88, optional 0, operator 13–19, 8 more digits; spaces/dashes anywhere.
  const bd = latin.match(/(?:\+?8[\s-]*8[\s-]*)?0?[\s-]*1[\s-]*[3-9](?:[\s-]*\d){8}/);
  if (bd) {
    const national = bd[0].replace(/\D/g, "").replace(/^88/, "");
    const local = national.startsWith("0") ? national : "0" + national;
    if (/^01[3-9]\d{8}$/.test(local)) return local;
  }
  return intlFirst ? "+" + intlFirst[0].replace(/\D/g, "") : null;
}

export function formatDateTime(
  iso: string | Date,
  timeZone: string,
  o: FormatOptions,
  style: "datetime" | "date" | "time" | "short" = "datetime",
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const opts: Intl.DateTimeFormatOptions =
    style === "date"
      ? { dateStyle: "medium" }
      : style === "time"
        ? { timeStyle: "short" }
        : style === "short"
          ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
          : { dateStyle: "medium", timeStyle: "short" };
  return new Intl.DateTimeFormat(intlLocale(o), { ...opts, timeZone }).format(d);
}

export function localDate(iso: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(iso);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

export function formatRelative(iso: string | Date, now: number, o: FormatOptions): string {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const diff = Math.round((t - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(o), { numeric: "auto", style: "short" });
  if (abs < 45) return rtf.format(0, "second");
  for (const [unit, secs] of UNITS) {
    if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(0, "second");
}

export function formatDuration(
  seconds: number,
  o: FormatOptions,
  labels: { d: string; h: string; m: string; s: string },
): string {
  const s = Math.max(0, Math.round(seconds));
  const n = (v: number) => formatNumber(v, o);
  if (s < 60) return `${n(s)}${labels.s}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${n(m)}${labels.m}`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${n(h)}${labels.h} ${n(m % 60)}${labels.m}` : `${n(h)}${labels.h}`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${n(d)}${labels.d} ${n(h % 24)}${labels.h}` : `${n(d)}${labels.d}`;
}

export function initials(name: string): string {
  const seg = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const first = (w: string) => (seg ? ([...seg.segment(w)][0]?.segment ?? "") : (w[0] ?? ""));
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(first).join("").toLocaleUpperCase();
}
