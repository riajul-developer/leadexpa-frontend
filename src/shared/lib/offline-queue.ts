"use client";

// Offline activity queue (FRONTEND_PROMPT §9, M4): outcomes logged without a connection are stored with the
// Idempotency-Key they will be sent with, and replayed in order on reconnect. The API replays the first
// response for a repeated key, so a replay can never log a call twice.
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api } from "./api/client";
import type { components } from "./api/schema";

export type ActivityBody = components["schemas"]["ActivityCreate"];

export interface QueuedActivity {
  key: string; // Idempotency-Key
  leadId: string;
  body: ActivityBody;
  queuedAt: string;
}

interface QueueState {
  items: QueuedActivity[];
  enqueue: (leadId: string, body: ActivityBody) => QueuedActivity;
  remove: (key: string) => void;
}

export const useOfflineQueue = create<QueueState>()(
  persist(
    (set) => ({
      items: [],
      enqueue: (leadId, body) => {
        const item: QueuedActivity = {
          key: crypto.randomUUID(),
          leadId,
          body: { ...body, occurred_at: body.occurred_at ?? new Date().toISOString() },
          queuedAt: new Date().toISOString(),
        };
        set((s) => ({ items: [...s.items, item] }));
        return item;
      },
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
    }),
    { name: "recov-offline-activities" },
  ),
);

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export interface ReplayResult {
  sent: QueuedActivity[];
  rejected: QueuedActivity[];
}

let replaying = false;

/** Sends queued activities oldest first. Network failures stop the run (retry later); 4xx drops the item. */
export async function replayQueue(): Promise<ReplayResult> {
  const result: ReplayResult = { sent: [], rejected: [] };
  if (replaying || isOffline()) return result;
  replaying = true;
  try {
    for (const item of [...useOfflineQueue.getState().items]) {
      let status: number;
      try {
        const { response } = await api.POST("/v1/leads/{leadId}/activities", {
          params: { path: { leadId: item.leadId } },
          headers: { "Idempotency-Key": item.key },
          body: item.body,
        });
        status = response.status;
      } catch {
        break; // still offline or the API is down: keep the rest for the next attempt
      }
      if (status >= 500 || status === 429) break;
      useOfflineQueue.getState().remove(item.key);
      (status < 300 ? result.sent : result.rejected).push(item);
    }
  } finally {
    replaying = false;
  }
  return result;
}
