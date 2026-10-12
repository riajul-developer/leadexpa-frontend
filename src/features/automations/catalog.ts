import type { ActionType, EventType, Op } from "./api";

/** What a condition can look at (mirrors the backend catalog in automation/domain.go). */
export type ValueInput =
  | "text"
  | "number"
  | "bool"
  | "stage"
  | "quality"
  | "source_kind"
  | "client"
  | "member"
  | "activity_type"
  | "outcome"
  | "sla_kind";

export interface FieldDef {
  key: string;
  kind: "text" | "number" | "bool" | "list";
  input: ValueInput;
  /** Event fields only exist on some events. */
  events?: EventType[];
}

export const EVENTS: EventType[] = [
  "lead.created",
  "lead.stage_changed",
  "lead.activity_logged",
  "lead.assigned",
  "sla.breached",
];

export const FIELDS: FieldDef[] = [
  { key: "lead.source_kind", kind: "text", input: "source_kind" },
  { key: "lead.client_id", kind: "text", input: "client" },
  { key: "lead.campaign", kind: "text", input: "text" },
  { key: "lead.stage", kind: "text", input: "stage" },
  { key: "lead.quality", kind: "text", input: "quality" },
  { key: "lead.owner_user_id", kind: "text", input: "member" },
  { key: "lead.priority", kind: "number", input: "number" },
  { key: "lead.tags", kind: "list", input: "text" },
  { key: "lead.phone_country", kind: "text", input: "text" },
  { key: "lead.utm_source", kind: "text", input: "text" },
  { key: "lead.utm_medium", kind: "text", input: "text" },
  { key: "lead.utm_campaign", kind: "text", input: "text" },
  { key: "lead.has_phone", kind: "bool", input: "bool" },
  { key: "lead.has_email", kind: "bool", input: "bool" },
  { key: "lead.duplicate_count", kind: "number", input: "number" },
  { key: "custom", kind: "text", input: "text" },
  { key: "event.from_stage", kind: "text", input: "stage", events: ["lead.stage_changed"] },
  { key: "event.to_stage", kind: "text", input: "stage", events: ["lead.stage_changed"] },
  { key: "event.activity_type", kind: "text", input: "activity_type", events: ["lead.activity_logged"] },
  { key: "event.outcome", kind: "text", input: "outcome", events: ["lead.activity_logged"] },
  { key: "event.sla_kind", kind: "text", input: "sla_kind", events: ["sla.breached"] },
];

export const OPS: Record<FieldDef["kind"], Op[]> = {
  text: ["eq", "neq", "in", "not_in", "contains", "not_contains", "exists", "not_exists"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  bool: ["eq"],
  list: ["contains", "not_contains", "exists", "not_exists"],
};

export const ACTIONS: ActionType[] = [
  "assign",
  "tag",
  "set_priority",
  "notify",
  "enroll_sequence",
  "create_task",
  "send_webhook",
];

export const OPTIONS: Partial<Record<ValueInput, string[]>> = {
  stage: ["new", "contacted", "qualified", "won", "lost"],
  quality: ["valid", "suspect", "junk"],
  source_kind: [
    "web_form",
    "meta_lead_ads",
    "manual",
    "csv",
    "api",
    "email_in",
    "messenger",
    "instagram",
    "whatsapp",
    "phone",
  ],
  activity_type: ["call", "whatsapp", "sms", "email", "meeting", "note", "messenger", "instagram"],
  outcome: [
    "connected",
    "no_answer",
    "busy",
    "wrong_number",
    "callback_requested",
    "interested",
    "not_interested",
    "missed",
  ],
  sla_kind: ["first_response", "follow_up"],
};

/** "custom.service" → the catalog entry for custom fields. */
export function fieldDef(key: string): FieldDef | undefined {
  return (
    FIELDS.find((f) => f.key === key) ??
    (key.startsWith("custom.") ? FIELDS.find((f) => f.key === "custom") : undefined)
  );
}

export function needsValue(op: Op) {
  return op !== "exists" && op !== "not_exists";
}
