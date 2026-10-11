"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { create } from "zustand";

import { track } from "@/shared/lib/analytics";
import { telHref, whatsappHref } from "@/shared/lib/format";

import type { Lead } from "../api/hooks";
// The sheet loads on the first contact; list pages don't pay for it up front.
const OutcomeSheet = dynamic(() => import("./outcome-sheet").then((m) => m.OutcomeSheet));

export type Channel = "call" | "whatsapp";

type ContactLead = Pick<Lead, "id" | "full_name" | "phone" | "received_at" | "first_response_at" | "stage">;

interface ContactFlowState {
  /** Lead the agent just contacted; its outcome sheet opens when they come back to the tab. */
  pending: { lead: ContactLead; channel: Channel; startedAt: number } | null;
  /** Lead whose outcome sheet is open. */
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

/**
 * Opens the phone dialer / WhatsApp and arms the outcome prompt. Works as a plain link (so long-press,
 * "open in new tab" and accessibility behave like a link), with the outcome flow attached.
 */
export function contactHref(lead: ContactLead, channel: Channel, text?: string): string | undefined {
  if (!lead.phone) return undefined;
  return channel === "call" ? telHref(lead.phone.e164) : whatsappHref(lead.phone.e164, text);
}

export function onContactClick(lead: ContactLead, channel: Channel) {
  track(channel === "call" ? "lead.call.started" : "lead.whatsapp.opened");
  useContactFlow.getState().start(lead, channel);
}

/**
 * Mounted once per page that offers Call/WhatsApp. When the tab becomes visible again after a contact
 * (visibilitychange), the outcome sheet opens. Desktops without a dialer never leave the tab, so the sheet
 * also opens after a short delay.
 */
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
