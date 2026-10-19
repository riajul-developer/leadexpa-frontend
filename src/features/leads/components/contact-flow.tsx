"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { create } from "zustand";

import { track } from "@/shared/lib/analytics";
import { telHref, whatsappHref } from "@/shared/lib/format";

import type { Lead } from "../api/hooks";
const OutcomeSheet = dynamic(() => import("./outcome-sheet").then((m) => m.OutcomeSheet));

export type Channel = "call" | "whatsapp";

type ContactLead = Pick<Lead, "id" | "full_name" | "phone" | "received_at" | "first_response_at" | "stage">;

interface ContactFlowState {
  pending: { lead: ContactLead; channel: Channel; startedAt: number } | null;
  open: { lead: ContactLead; channel: Channel } | null;
  start: (lead: ContactLead, channel: Channel) => void;
  showOutcome: (lead: ContactLead, channel: Channel) => void;
  close: () => void;
}

export const useContactFlow = create<ContactFlowState>((set) => ({
  pending: null,
  open: null,
  start: (lead, channel) => set({ pending: { lead, channel, startedAt: Date.now() } }),
  showOutcome: (lead, channel) => set({ open: { lead, channel }, pending: null }),
  close: () => set({ open: null }),
}));

/** A plain link so long-press, "open in new tab" and a11y behave natively. */
export function contactHref(lead: ContactLead, channel: Channel, text?: string): string | undefined {
  if (!lead.phone) return undefined;
  return channel === "call" ? telHref(lead.phone.e164) : whatsappHref(lead.phone.e164, text);
}

export function onContactClick(lead: ContactLead, channel: Channel) {
  track(channel === "call" ? "lead.call.started" : "lead.whatsapp.opened");
  useContactFlow.getState().start(lead, channel);
}

/** Opens the outcome sheet on visibilitychange, or after a delay on desktops without a dialer. */
export function ContactFlowHost() {
  const { pending, open, showOutcome, close } = useContactFlow();
  useEffect(() => {
    if (!pending) return;
    let left = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") left = true;
      else if (left) showOutcome(pending.lead, pending.channel);
    };
    document.addEventListener("visibilitychange", onVis);
    const fallback = setTimeout(() => {
      if (!left) showOutcome(pending.lead, pending.channel);
    }, 2500);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(fallback);
    };
  }, [pending, showOutcome]);
  if (!open) return null;
  return <OutcomeSheet lead={open.lead} channel={open.channel} onClose={close} />;
}
