export interface LeadFilters {
  client_id?: string;
  stage?: string;
  owner?: string;
  source_id?: string;
  campaign_id?: string;
  received_from?: string;
  received_to?: string;
  q?: string;
  quality?: "valid" | "suspect" | "junk" | "all";
  sla?: "overdue";
}

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (f: LeadFilters) => [...leadKeys.lists(), f] as const,
  details: () => [...leadKeys.all, "detail"] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
  activities: (id: string) => [...leadKeys.all, "activities", id] as const,
  sla: (id: string) => [...leadKeys.all, "sla", id] as const,
  sales: (id: string) => [...leadKeys.all, "sales", id] as const,
  nextAction: (id: string) => [...leadKeys.all, "next-action", id] as const,
  conversations: (id: string) => [...leadKeys.all, "conversations", id] as const,
};

export const qualityKeys = {
  counts: (clientId?: string) => ["lead-quality-counts", clientId ?? null] as const,
};

export const inboxKeys = {
  all: ["inbox"] as const,
};

export const pipelineKeys = {
  all: ["pipeline"] as const,
  board: (clientId: string) => [...pipelineKeys.all, clientId] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly: boolean) => [...notificationKeys.all, "list", unreadOnly] as const,
  prefs: ["notifications", "prefs"] as const,
};

export const importKeys = {
  all: ["imports"] as const,
  detail: (id: string) => [...importKeys.all, id] as const,
  list: (clientId: string) => [...importKeys.all, "client", clientId] as const,
};

export const metaKeys = {
  overview: ["integrations", "meta"] as const,
  unrouted: ["integrations", "meta", "unrouted"] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  view: (p: { from: string; to: string; client_id?: string }) => [...dashboardKeys.all, p] as const,
};

export const clientKeys = {
  detail: (id: string) => ["clients", id] as const,
  assignments: (id: string) => ["clients", id, "assignments"] as const,
  slaPolicy: (id: string) => ["clients", id, "sla-policy"] as const,
  calendar: (id: string) => ["clients", id, "calendar"] as const,
  campaigns: (id: string) => ["clients", id, "campaigns"] as const,
  aiProfile: (id: string) => ["clients", id, "ai-profile"] as const,
  reports: (id: string) => ["clients", id, "reports"] as const,
};

export const reportKeys = {
  detail: (id: string) => ["reports", id] as const,
  shares: (id: string) => ["reports", id, "shares"] as const,
};

export const reviewKeys = {
  all: ["ingestion-review"] as const,
  list: ["ingestion-review", "list"] as const,
  count: ["ingestion-review", "count"] as const,
};

export const conversationKeys = {
  all: ["conversations"] as const,
  list: (f: { client?: string; channel?: string; unread?: boolean }) => ["conversations", "list", f] as const,
  detail: (id: string) => ["conversations", "detail", id] as const,
  messages: (id: string) => ["conversations", "messages", id] as const,
};

export const channelKeys = {
  client: (clientId: string) => ["channels", clientId] as const,
  templates: (accountId: string) => ["channels", "templates", accountId] as const,
  settings: ["messaging-settings"] as const,
};
