// Plain module (not "use client"): the server route validates the tab with this list. Values exported from a
// client module reach server code as client references, not arrays.
export const SETTINGS_TABS = [
  "profile",
  "security",
  "sso",
  "group",
  "agency",
  "team",
  "scoring",
  "calendar",
  "branding",
  "notifications",
  "messaging",
  "calls",
  "developer",
  "billing",
  "audit-log",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
