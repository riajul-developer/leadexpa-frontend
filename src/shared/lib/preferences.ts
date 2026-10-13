// UI preferences. Device-only ones (sounds, consent) live in localStorage; the display preferences
// (digits, hour cycle, timezone) are owned by the server (PATCH /v1/me) and mirrored here so formatting
// never waits for a request. `region`/`agencyTimeZone`/`agencyCurrency` mirror the active agency.
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Digits, HourCycle } from "./format";

interface Preferences {
  digits: Digits;
  hourCycle: HourCycle | null;
  /** The user's display timezone (null = the agency's). */
  timeZone: string | null;
  region: string | null;
  agencyTimeZone: string | null;
  agencyCurrency: string | null;
  slaSound: boolean;
  analyticsConsent: boolean | null;
  setDigits: (d: Digits) => void;
  setSlaSound: (v: boolean) => void;
  setAnalyticsConsent: (v: boolean) => void;
  /** Mirrors /v1/me after sign-in or a preference change. */
  syncFromMe: (me: {
    user: { number_system: Digits; hour_cycle: HourCycle | null; timezone: string | null };
    agency: { country: string; default_timezone: string; default_currency: string } | null;
  }) => void;
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      digits: "latn",
      hourCycle: null,
      timeZone: null,
      region: null,
      agencyTimeZone: null,
      agencyCurrency: null,
      slaSound: false,
      analyticsConsent: null,
      setDigits: (digits) => set({ digits }),
      setSlaSound: (slaSound) => set({ slaSound }),
      setAnalyticsConsent: (analyticsConsent) => set({ analyticsConsent }),
      syncFromMe: (me) =>
        set({
          digits: me.user.number_system,
          hourCycle: me.user.hour_cycle,
          timeZone: me.user.timezone,
          region: me.agency?.country ?? null,
          agencyTimeZone: me.agency?.default_timezone ?? null,
          agencyCurrency: me.agency?.default_currency ?? null,
        }),
    }),
    {
      name: "recov-prefs",
      version: 1,
      skipHydration: true,
      // v0 stored Bangla digits as "beng"; every locale's own digits are "native" now.
      migrate: (state, version) => {
        const s = (state ?? {}) as { digits?: string };
        if (version < 1 && s.digits === "beng") s.digits = "native";
        return s as Preferences;
      },
    },
  ),
);

/** The browser's zone; the last fallback when neither the user nor the agency set one. */
function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Zone for times that aren't tied to a client: the user's, else the agency's, else the browser's. */
export function useDisplayTimeZone(): string {
  const own = usePreferences((s) => s.timeZone);
  const agency = usePreferences((s) => s.agencyTimeZone);
  return own ?? agency ?? browserZone();
}

/** The agency's default currency, for amounts that have no client of their own. */
export function useAgencyCurrency(): string {
  return usePreferences((s) => s.agencyCurrency) ?? "USD";
}
