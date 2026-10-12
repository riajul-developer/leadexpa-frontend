import { describe, expect, it } from "vitest";

import {
  extractPhone,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPercent,
  formatPhone,
  formatRelative,
  initials,
  parseMoney,
  intlLocale,
  toBanglaDigits,
  toLatinDigits,
  toNativeDigits,
  whatsappHref,
} from ".";

const bn = { locale: "bn", digits: "latn" } as const;
const bnDigits = { locale: "bn", digits: "native" } as const;
const ar = { locale: "ar", digits: "latn" } as const;
const arDigits = { locale: "ar", digits: "native" } as const;
const en = { locale: "en", digits: "latn" } as const;

describe("digits", () => {
  it("normalizes Bangla digits", () => {
    expect(toLatinDigits("০১৭১২-৩৪৫৬৭৮")).toBe("01712-345678");
    expect(toBanglaDigits("2026")).toBe("২০২৬");
  });
});

describe("money", () => {
  it("uses lakh grouping and ৳ in bn, ISO code in en", () => {
    expect(formatMoney({ amount_minor: 14_900_000, currency: "BDT" }, bn)).toBe("৳1,49,000");
    expect(formatMoney({ amount_minor: 14_900_000, currency: "BDT" }, bnDigits)).toBe("৳১,৪৯,০০০");
    expect(formatMoney({ amount_minor: 14_900_000, currency: "BDT" }, en)).toBe("BDT 149,000");
    expect(formatMoney({ amount_minor: 12_345, currency: "BDT" }, en)).toBe("BDT 123.45");
    expect(formatMoney(null, en)).toBe("—");
  });
  it("parses Bangla and Latin money input", () => {
    expect(parseMoney("১,৪৯,০০০", "BDT")).toBe(14_900_000);
    expect(parseMoney("৳ 5,000.50", "BDT")).toBe(500_050);
    expect(parseMoney("abc", "BDT")).toBeNull();
    expect(parseMoney("1.234", "BDT")).toBeNull();
  });
});

describe("global money and digits", () => {
  it("formats any currency with its own exponent", () => {
    expect(formatMoney({ amount_minor: 10_000, currency: "USD" }, en)).toBe("$100");
    expect(formatMoney({ amount_minor: 122_180, currency: "USD" }, en)).toBe("$1,221.80");
    expect(formatMoney({ amount_minor: 15_000, currency: "JPY" }, en)).toBe("¥15,000");
    expect(formatMoney({ amount_minor: 1_250, currency: "KWD" }, en)).toBe("KWD 1.250"); // three decimals: fils
    expect(formatMoney({ amount_minor: 100_000, currency: "AED" }, arDigits)).toContain("١٬٠٠٠");
  });
  it("parses money typed in any script", () => {
    expect(parseMoney("١٬٥٠٠٫٥٠", "AED")).toBe(150_050);
    expect(parseMoney("$ 5,000.50", "USD")).toBe(500_050);
    expect(parseMoney("1.234", "KWD")).toBe(1_234);
    expect(parseMoney("1500", "JPY")).toBe(1_500);
    expect(parseMoney("1500.5", "JPY")).toBeNull();
  });
  it("normalizes every native digit set", () => {
    expect(toLatinDigits("٠١٢٣ ۴۵ ६७")).toBe("0123 45 67");
    expect(toNativeDigits("2026", "ar")).toBe("٢٠٢٦");
    expect(toNativeDigits("2026", "en")).toBe("2026");
  });
  it("builds Intl tags with region, digits and clock", () => {
    expect(intlLocale(en)).toBe("en-US");
    expect(intlLocale({ ...en, region: "gb", hourCycle: "h23" })).toBe("en-GB-u-hc-h23");
    expect(intlLocale(bn)).toBe("bn-BD-u-nu-latn");
    expect(intlLocale({ ...arDigits, region: "SA" })).toBe("ar-SA-u-nu-arab");
    expect(intlLocale(ar)).toBe("ar-u-nu-latn");
    expect(intlLocale({ locale: "en-XA", digits: "latn", region: "BD" })).toBe("en-BD");
  });
  it("extracts international numbers from pasted text", () => {
    expect(extractPhone("call me on +971 50 123 4567")).toBe("+971501234567");
    expect(extractPhone("+44 (0)20 7946 0958")).toBe("+4402079460958");
  });
});

describe("percent", () => {
  it("never shows 0 % for a missing denominator", () => {
    expect(formatPercent(null, en)).toBe("—");
    expect(formatPercent(0.6234, en)).toBe("62%");
  });
});

describe("phone", () => {
  it("formats BD numbers nationally and builds links", () => {
    expect(formatPhone("+8801712345678")).toBe("01712-345678");
    expect(whatsappHref("+8801712345678", "আসসালামু আলাইকুম")).toBe(
      "https://wa.me/8801712345678?text=%E0%A6%86%E0%A6%B8%E0%A6%B8%E0%A6%BE%E0%A6%B2%E0%A6%BE%E0%A6%AE%E0%A7%81%20%E0%A6%86%E0%A6%B2%E0%A6%BE%E0%A6%87%E0%A6%95%E0%A7%81%E0%A6%AE",
    );
  });
  it("extracts phones from pasted text", () => {
    expect(extractPhone("নাম: করিম, মোবাইল ০১৭১২-৩৪৫৬৭৮")).toBe("01712345678");
    expect(extractPhone("call +880 1812 345678 pls")).toBe("01812345678");
    expect(extractPhone("no number here")).toBeNull();
  });
});

describe("dates", () => {
  it("formats in the client's timezone", () => {
    // 12:55 UTC is 18:55 in Dhaka.
    expect(formatDateTime("2026-10-08T12:55:00Z", "Asia/Dhaka", en, "time")).toBe("6:55 PM");
  });
  it("formats relative times in both locales", () => {
    const now = Date.parse("2026-10-11T10:00:00Z");
    expect(formatRelative("2026-10-11T09:55:00Z", now, en)).toBe("5 min. ago");
    expect(formatRelative("2026-10-11T09:55:00Z", now, bnDigits)).toContain("৫");
  });
  it("formats compact durations", () => {
    const l = { d: "d", h: "h", m: "m", s: "s" };
    expect(formatDuration(42, en, l)).toBe("42s");
    expect(formatDuration(12 * 60, en, l)).toBe("12m");
    expect(formatDuration(3 * 3600 + 5 * 60, en, l)).toBe("3h 5m");
    expect(formatDuration(2 * 86400 + 4 * 3600, en, l)).toBe("2d 4h");
  });
});

describe("initials", () => {
  it("keeps Bangla grapheme clusters intact", () => {
    expect(initials("Karim Hasan")).toBe("KH");
    expect(initials("ক্ষমা রায়")).toBe("ক্ষরা"); // first grapheme clusters: ক্ষ + রা
    expect(initials("")).toBe("");
  });
});
