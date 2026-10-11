import { describe, expect, it } from "vitest";

import { autoMap, guessField, hasContactColumn, normalizeHeader } from "./mapping";

describe("CSV header auto-mapping", () => {
  it("normalizes headers like the backend", () => {
    expect(normalizeHeader(" Mobile Number ")).toBe("mobile_number");
    expect(normalizeHeader("﻿Name")).toBe("name");
    expect(normalizeHeader("মোবাইল নম্বর")).toBe("মোবাইল_নম্বর");
    expect(normalizeHeader("_fbp")).toBe("_fbp");
  });

  it("recognizes English and Bangla headers", () => {
    expect(guessField("নাম")).toBe("full_name");
    expect(guessField("মোবাইল")).toBe("phone");
    expect(guessField("Phone")).toBe("phone");
    expect(guessField("Email Address")).toBe("email");
    expect(guessField("Budget")).toBe("custom");
  });

  it("prefers the API suggestion and never maps a field twice", () => {
    const m = autoMap(["নাম", "Phone", "Mobile", "Notes"], { Notes: "_ignore" });
    expect(m).toEqual({ নাম: "full_name", Phone: "phone", Mobile: "custom", Notes: "_ignore" });
    expect(hasContactColumn(m)).toBe(true);
    expect(hasContactColumn({ নাম: "full_name" })).toBe(false);
  });
});
