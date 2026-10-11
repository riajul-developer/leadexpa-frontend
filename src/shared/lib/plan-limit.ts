"use client";

import { create } from "zustand";

import type { PlanLimit } from "./api/errors";

/** Global upgrade prompt state: any API call hitting `402 plan_limit` sets it (wired in the query client). */
export const usePlanLimit = create<{ limit: PlanLimit | null; show: (l: PlanLimit) => void; hide: () => void }>(
  (set) => ({
    limit: null,
    show: (limit) => set({ limit }),
    hide: () => set({ limit: null }),
  }),
);
