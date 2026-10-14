// Multi-region login (GLOBAL_PROMPT G1 6.2): sign-in starts anywhere; the control plane says which region holds
// the account and the browser continues on that region's app. Without NEXT_PUBLIC_CONTROL_URL (a single cell)
// this does nothing. Only the email is sent, never the password.

export type RegionChoice = { region: string; app_url: string; api_url: string };

const CONTROL = process.env.NEXT_PUBLIC_CONTROL_URL ?? "";

export async function lookupRegions(email: string): Promise<RegionChoice[]> {
  if (!CONTROL) return [];
  try {
    const res = await fetch(`${CONTROL.replace(/\/$/, "")}/v1/directory/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "omit",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { regions?: RegionChoice[] };
    return (body.regions ?? []).filter((r) => /^https?:\/\//.test(r.app_url));
  } catch {
    return []; // the control plane is down: sign in here, as a single cell would
  }
}

/** True when a region's app is this site. */
export function isHere(r: RegionChoice): boolean {
  return typeof window !== "undefined" && r.app_url.replace(/\/$/, "") === window.location.origin;
}

/** The region's sign-in page with the email filled in. */
export function regionLoginURL(r: RegionChoice, locale: string, email: string): string {
  return `${r.app_url.replace(/\/$/, "")}/${locale}/login?email=${encodeURIComponent(email)}`;
}
