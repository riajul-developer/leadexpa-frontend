// Not a client module: server code would get client references, not arrays.
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
