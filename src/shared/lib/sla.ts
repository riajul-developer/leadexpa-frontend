// The server decides deadlines; the client only counts down to them.
import { useEffect, useSyncExternalStore } from "react";

import { serverNow } from "./server-time";

export type SlaState = "on_track" | "due_soon" | "overdue" | "met" | "paused" | "none";

export interface SlaInput {
  sla: { status: "on_track" | "due_soon" | "overdue" | "met"; due_at: string | null; kind: string | null } | null;
  received_at: string;
  first_response_at: string | null;
  next_callback_at: string | null;
  stage: string;
}

export interface SlaView {
  state: SlaState;
  seconds: number;
  at?: string;
  kind?: string | null;
}

export const DUE_SOON_SECONDS = 5 * 60;
export const FINE_TICK_SECONDS = 10 * 60;

export function slaView(lead: SlaInput, now: number): SlaView {
  const closed = lead.stage === "won" || lead.stage === "lost";
  const { sla } = lead;
  if (sla?.status === "met" || (!sla && lead.first_response_at && !closed)) {
    const responded = lead.first_response_at
      ? (Date.parse(lead.first_response_at) - Date.parse(lead.received_at)) / 1000
      : 0;
    if (lead.next_callback_at && Date.parse(lead.next_callback_at) > now && !closed) {
      return { state: "paused", seconds: 0, at: lead.next_callback_at, kind: sla?.kind };
    }
    return { state: "met", seconds: Math.max(0, responded), kind: sla?.kind };
  }
  if (!sla?.due_at || closed) {
    if (lead.next_callback_at && !closed) return { state: "paused", seconds: 0, at: lead.next_callback_at };
    return { state: "none", seconds: 0 };
  }
  const remaining = (Date.parse(sla.due_at) - now) / 1000;
  if (remaining <= 0 || sla.status === "overdue")
    return { state: "overdue", seconds: Math.max(0, -remaining), kind: sla.kind };
  if (remaining <= DUE_SOON_SECONDS || sla.status === "due_soon")
    return { state: "due_soon", seconds: remaining, kind: sla.kind };
  return { state: "on_track", seconds: remaining, kind: sla.kind };
}

export function needsFineTick(v: SlaView): boolean {
  return (v.state === "due_soon" || v.state === "on_track") && v.seconds < FINE_TICK_SECONDS;
}

// One shared ticker: 1 s while any chip needs it, else 60 s.

let now = typeof window === "undefined" ? 0 : serverNow();
const listeners = new Set<() => void>();
let fineSubscribers = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (listeners.size === 0) return;
  const period = fineSubscribers > 0 ? 1000 : 60_000;
  const wait = period - (serverNow() % period);
  timer = setTimeout(() => {
    now = serverNow();
    listeners.forEach((l) => l());
    schedule();
  }, wait);
}

function subscribe(l: () => void) {
  // Refresh only on wake: moving `now` on every subscribe can loop re-renders.
  if (listeners.size === 0) now = serverNow();
  listeners.add(l);
  schedule();
  return () => {
    listeners.delete(l);
    schedule();
  };
}

export function useNow(fine = false): number {
  useEffect(() => {
    if (!fine) return;
    fineSubscribers += 1;
    schedule();
    return () => {
      fineSubscribers -= 1;
      schedule();
    };
  }, [fine]);
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}

export function __tickerState() {
  return { listeners: listeners.size, fineSubscribers, running: timer !== null };
}
