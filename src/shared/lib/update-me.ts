"use client";

// Saving the caller's own preferences. Separate from session.ts so the app shell's first load doesn't carry it
// (only the lazily loaded account menu and the settings page use it).
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./api/client";
import { usePreferences } from "./preferences";
import { meKey } from "./session";

export type MePatch = Schemas["MePatch"];

/**
 * Saves the caller's own preferences (PATCH /v1/me). The local mirror updates first so digits, clock and
 * zone change instantly; the server's answer then replaces it.
 */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: MePatch) => unwrap(api.PATCH("/v1/me", { body: patch })),
    onMutate: (patch) => {
      const prefs = usePreferences.getState();
      if (patch.number_system) prefs.setDigits(patch.number_system);
    },
    onSuccess: (me) => {
      qc.setQueryData(meKey, me);
      usePreferences.getState().syncFromMe(me);
    },
  });
}
