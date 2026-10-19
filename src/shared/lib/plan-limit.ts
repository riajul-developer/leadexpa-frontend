"use client";

import { create } from "zustand";

import type { PlanLimit } from "./api/errors";

export const usePlanLimit = create<{ limit: PlanLimit | null; show: (l: PlanLimit) => void; hide: () => void }>(
  (set) => ({
    limit: null,
    show: (limit) => set({ limit }),
    hide: () => set({ limit: null }),
  }),
);
