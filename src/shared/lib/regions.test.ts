import { afterEach, describe, expect, it, vi } from "vitest";

async function load(control: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CONTROL_URL", control);
  return import("./regions");
}

describe("region lookup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does nothing without a control plane", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const { lookupRegions } = await load("");
    expect(await lookupRegions("a@b.test")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns the regions with an app, and falls back to here when the control plane is down", async () => {
    const { lookupRegions, regionLoginURL } = await load("https://control.test/");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          regions: [
            { region: "eu1", app_url: "https://eu1.app.test", api_url: "https://eu1.api.test" },
            { region: "zz1", app_url: "javascript:alert(1)", api_url: "" },
          ],
        }),
      ),
    );
    const found = await lookupRegions("Owner@Clinic.test");
    expect(found.map((r) => r.region)).toEqual(["eu1"]);
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://control.test/v1/directory/lookup");
    expect(JSON.parse(String(init?.body))).toEqual({ email: "Owner@Clinic.test" }); // never the password
    expect(regionLoginURL(found[0]!, "bn", "a+b@c.test")).toBe("https://eu1.app.test/bn/login?email=a%2Bb%40c.test");

    spy.mockRejectedValueOnce(new TypeError("offline"));
    expect(await lookupRegions("a@b.test")).toEqual([]);
  });
});
