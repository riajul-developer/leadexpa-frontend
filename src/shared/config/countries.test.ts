import { describe, expect, it } from "vitest";

import { COUNTRIES, composePhone, countryForTimeZone, countryOptions, DIAL_CODES } from "./countries";
import { dir, isRTL, toApiLocale } from "./locales";

describe("countries", () => {
  it("guesses the signup country from the browser zone", () => {
    expect(countryForTimeZone("Asia/Dubai")).toBe("AE");
    expect(countryForTimeZone("America/Los_Angeles")).toBe("US");
    expect(countryForTimeZone("Asia/Calcutta")).toBe("IN");
    expect(countryForTimeZone("Mars/Base")).toBe("");
  });

  it("has a dialing code for every curated country", () => {
    expect(COUNTRIES.filter((c) => !DIAL_CODES[c])).toEqual([]);
  });

  it("names countries in the UI language", () => {
    const ar = countryOptions("ar");
    expect(ar.find((o) => o.code === "AE")?.name).toMatch(/الإمارات/);
    expect(countryOptions("en").find((o) => o.code === "BD")?.name).toBe("Bangladesh");
  });

  it("composes phones: local habits in the client's country, a dialing code elsewhere", () => {
    expect(composePhone("01712-345678", "BD", "BD")).toBe("01712-345678");
    expect(composePhone("050 123 4567", "AE", "BD")).toBe("+971501234567");
    expect(composePhone("+44 20 7946 0958", "AE", "BD")).toBe("+44 20 7946 0958");
    expect(composePhone("", "AE", "BD")).toBe("+971");
  });
});

describe("locales", () => {
  it("knows direction and maps the pseudo-locale for the API", () => {
    expect(isRTL("ar")).toBe(true);
    expect(dir("bn")).toBe("ltr");
    expect(toApiLocale("en-XA")).toBe("en");
    expect(toApiLocale("ar")).toBe("ar");
  });
});
