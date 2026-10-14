import { afterEach, describe, expect, it, vi } from "vitest";

import { api, API_URL, apiBase, setApiBase } from "./client";

// G1: the API base follows the agency's region (from /v1/me); a 421 sends the browser to that region's app.
describe("region-aware API client", () => {
  afterEach(() => {
    setApiBase(API_URL);
    vi.restoreAllMocks();
  });

  it("switches base only to a real http(s) URL", () => {
    setApiBase("https://eu1.api.test/");
    expect(apiBase()).toBe("https://eu1.api.test");
    setApiBase("javascript:alert(1)");
    setApiBase("");
    expect(apiBase()).toBe("https://eu1.api.test");
  });

  it("sends calls to the region and follows wrong_region", async () => {
    setApiBase("https://eu1.api.test");
    const seen: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      seen.push(input instanceof Request ? input.url : String(input));
      return new Response(
        JSON.stringify({ code: "wrong_region", region: { region: "me1", app_url: "https://me1.app.test" } }),
        { status: 421, headers: { "Content-Type": "application/problem+json" } },
      );
    });
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: "http://localhost:3000",
      pathname: "/en/leads",
      search: "?stage=new",
      assign,
    } as Location);

    await api.GET("/v1/leads");
    expect(seen[0]).toMatch(/^https:\/\/eu1\.api\.test\/v1\/leads/);
    expect(assign).toHaveBeenCalledWith("https://me1.app.test/en/leads?stage=new");
  });
});
