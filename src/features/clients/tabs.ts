// Plain module (not "use client"): the server route validates the tab with this list. Values exported from a
// client module reach server code as client references, not arrays.
export const CLIENT_TABS = [
  "overview",
  "health",
  "sources",
  "channels",
  "sla",
  "team",
  "campaigns",
  "conversions",
  "payments",
  "reports",
  "ai",
  "agent",
  "booking",
  "offline",
  "reviews",
] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];
