"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./api/client";
import { usePreferences } from "./preferences";
import { meKey } from "./session";

export type MePatch = Schemas["MePatch"];

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
