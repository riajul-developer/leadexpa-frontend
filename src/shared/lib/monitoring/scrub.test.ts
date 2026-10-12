import type { ErrorEvent } from "@sentry/nextjs";

import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "./scrub";

describe("scrubText", () => {
  it("masks emails and phone numbers in Latin and Bangla digits", () => {
    expect(scrubText("dup lead rahim@example.com +880 1712-345678")).toBe("dup lead [Filtered] [Filtered]");
    expect(scrubText("phone ০১৭১২৩৪৫৬৭৮ invalid")).toBe("phone [Filtered] invalid");
  });

  it("keeps short numbers and ids", () => {
    expect(scrubText("HTTP 422 on step 3")).toBe("HTTP 422 on step 3");
  });

  it("masks tokens in public and auth links", () => {
    expect(scrubText("GET /bn/r/AbC123xyz failed")).toBe("GET /bn/r/[Filtered] failed");
    expect(scrubText("/en/invite/tok_9")).toBe("/en/invite/[Filtered]");
  });
});

describe("scrubUrl", () => {
  it("drops the query string", () => {
    expect(scrubUrl("https://app.recov.io/bn/leads?q=01712345678#x")).toBe("https://app.recov.io/bn/leads");
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });

  it("removes PII keys and scrubs urls", () => {
    const out = scrubBreadcrumb({
      category: "fetch",
      data: { url: "https://api/v1/leads?q=rahim", status_code: 200, phone: "01712345678" },
    });
    expect(out?.data).toEqual({ url: "https://api/v1/leads", status_code: 200 });
  });
});

describe("scrubEvent", () => {
  it("keeps only the user id and request url/method", () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: "u1", email: "a@b.co", ip_address: "1.2.3.4" },
      request: { url: "https://app/bn/r/tok?x=1", method: "GET", cookies: { s: "1" }, headers: { a: "b" }, data: "x" },
      exception: { values: [{ type: "Error", value: "Lead 01712345678 not found" }] },
      extra: { noteBody: "secret", attempt: 2 },
    } as ErrorEvent);
    expect(event.user).toEqual({ id: "u1" });
    expect(event.request).toEqual({ url: "https://app/bn/r/[Filtered]", method: "GET" });
    expect(event.exception?.values?.[0]?.value).toBe("Lead [Filtered] not found");
    expect(event.extra).toEqual({ attempt: 2 });
  });
});
