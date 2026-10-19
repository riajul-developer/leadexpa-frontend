// Not a client module: client exports reach server code as references, not arrays.
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
