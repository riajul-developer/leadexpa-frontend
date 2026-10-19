import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Digits, HourCycle } from "./format";

interface Preferences {
  digits: Digits;
  hourCycle: HourCycle | null;
  timeZone: string | null;
  region: string | null;
  agencyTimeZone: string | null;
  agencyCurrency: string | null;
  slaSound: boolean;
  analyticsConsent: boolean | null;
  setDigits: (d: Digits) => void;
  setSlaSound: (v: boolean) => void;
  setAnalyticsConsent: (v: boolean) => void;
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
      // v0 stored Bangla digits as "beng"; they are "native" now.
      migrate: (state, version) => {
        const s = (state ?? {}) as { digits?: string };
        if (version < 1 && s.digits === "beng") s.digits = "native";
        return s as Preferences;
      },
    },
  ),
);

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useDisplayTimeZone(): string {
  const own = usePreferences((s) => s.timeZone);
  const agency = usePreferences((s) => s.agencyTimeZone);
  return own ?? agency ?? browserZone();
}

export function useAgencyCurrency(): string {
  return usePreferences((s) => s.agencyCurrency) ?? "USD";
}
