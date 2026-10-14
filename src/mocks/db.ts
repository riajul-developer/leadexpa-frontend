// In-memory mock database for the clickable prototype (FRONTEND_PROMPT §2.9). Typed against the generated
// OpenAPI schema, so a contract change breaks the mocks at compile time. Deterministic (seeded) so demos and
// screenshots are stable; times are relative to "now" so every SLA state is visible on load.
import { faker } from "@faker-js/faker";

import type { components } from "@/shared/lib/api/schema";

type S = components["schemas"];

faker.seed(2026);

const now = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const min = 60_000;
const id = () => faker.string.uuid();

const BANGLA_FIRST = [
  "রহিম",
  "করিম",
  "নুসরাত",
  "ফাতেমা",
  "সাকিব",
  "তানভীর",
  "মিম",
  "রাকিব",
  "সুমাইয়া",
  "আরিফ",
  "জান্নাত",
  "শাহরিয়ার",
];
const BANGLA_LAST = ["উদ্দিন", "হাসান", "জাহান", "আক্তার", "আহমেদ", "ইসলাম", "চৌধুরী", "রহমান", "খান", "হোসেন"];
const LATIN_FIRST = ["Rahim", "Karim", "Nusrat", "Fatema", "Shakib", "Tanvir", "Mim", "Rakib", "Sumaiya", "Arif"];
const LATIN_LAST = ["Uddin", "Hasan", "Jahan", "Akter", "Ahmed", "Islam", "Chowdhury", "Rahman", "Khan", "Hossain"];

function bdPhone() {
  const op = faker.helpers.arrayElement(["13", "14", "15", "16", "17", "18", "19"]);
  const rest = faker.string.numeric(8);
  return { e164: `+880${op}${rest}`, display: `01${op}${rest.slice(0, 2)}-${rest.slice(2)}` };
}

function personName() {
  return faker.datatype.boolean()
    ? `${faker.helpers.arrayElement(BANGLA_FIRST)} ${faker.helpers.arrayElement(BANGLA_LAST)}`
    : `${faker.helpers.arrayElement(LATIN_FIRST)} ${faker.helpers.arrayElement(LATIN_LAST)}`;
}

export const agency: S["Agency"] = {
  id: id(),
  name: "Demo Digital Agency",
  slug: "demo-digital",
  default_locale: "bn",
  default_timezone: "Asia/Dhaka",
  default_currency: "BDT",
  country: "BD",
  home_region: "ap1",
  reporting_currency: "BDT",
  require_admin_mfa: false,
  plan_code: "trial",
  trial_ends_at: iso(now() + 9 * 24 * 60 * min),
  status: "active",
  created_at: iso(now() - 5 * 24 * 60 * min),
  sandbox_of: null,
};

const people = [
  { name: "সাদিয়া ইসলাম", email: "owner@demo.recov.local", role: "owner" as const },
  { name: "Rahim Uddin", email: "agent1@demo.recov.local", role: "agent" as const },
  { name: "নুসরাত জাহান", email: "agent2@demo.recov.local", role: "agent" as const },
  { name: "Tanvir Ahmed", email: "manager@demo.recov.local", role: "manager" as const },
];

export const members: S["Member"][] = people.map((p) => ({
  id: id(),
  user: { id: id(), name: p.name, email: p.email, phone: null },
  role: p.role,
  status: "active",
  joined_at: iso(now() - 4 * 24 * 60 * min),
}));

export const me: S["Me"] = {
  user: {
    id: members[0]!.user.id,
    email: members[0]!.user.email,
    phone: null,
    name: members[0]!.user.name,
    locale: "bn",
    email_verified: true,
    timezone: null,
    number_system: "latn",
    hour_cycle: null,
    login_alerts: true,
    mfa_enabled: false,
  },
  agency,
  membership: { id: members[0]!.id, role: "owner" },
  permissions: [
    "agency.read",
    "agency.update",
    "member.read",
    "member.manage",
    "invite.manage",
    "audit.read",
    "billing.manage",
    "client.manage",
    "lead.read",
    "lead.update",
    "lead.assign",
    "lead.export",
    "lead.import",
    "activity.create",
    "sla.policy.manage",
    "report.read",
    "report.share",
    "integration.manage",
    "automation.manage",
  ],
  agencies: [{ id: agency.id, name: agency.name, slug: agency.slug, role: "owner", sandbox: false }],
  flags: { dm_capture: true },
  availability: "available",
  mfa_required: null,
  access_blocked: null,
  // One cell in the demo: the API is where the app booted from.
  region: "ap1",
  api_base_url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  app_url: typeof location === "undefined" ? "" : location.origin,
  read_only: false,
};

// Predictive score (17.7): a plausible rules-v1 score with its top factors.
export function mockScore(i: number, stage: string, responded: boolean, callback: boolean): S["LeadScore"] {
  const factors: S["LeadScore"]["factors"] = [];
  let value = 18 + ((i * 37) % 30);
  if (responded) {
    value += 25;
    factors.push({ feature: "responded", effect: 1.3, value: 1 });
  }
  if (callback) {
    value += 12;
    factors.push({ feature: "callback_planned", effect: 0.8, value: 1 });
  }
  if (i % 4 === 0) factors.push({ feature: "campaign_rate", effect: 0.62, value: 0.31 });
  if (!responded && stage === "new") factors.push({ feature: "slow_response", effect: -0.5, value: 1 });
  if (i % 5 === 1) {
    value -= 10;
    factors.push({ feature: "age_days", effect: -0.4, value: 0.33 });
  }
  value = Math.max(3, Math.min(96, value));
  return {
    value,
    band: value >= 60 ? "hot" : value >= 30 ? "warm" : "cold",
    version: "rules-v1",
    factors: factors.slice(0, 4),
  };
}

const clientSeeds = [
  { name: "Dhaka Dental Care", industry: "clinic" },
  { name: "Bashundhara Homes", industry: "real_estate" },
  { name: "Aarong Style House", industry: "ecommerce" },
];

export const clients: S["Client"][] = clientSeeds.map((c) => ({
  id: id(),
  name: c.name,
  industry: c.industry,
  country: "BD",
  timezone: "Asia/Dhaka",
  currency: "BDT",
  assignment_strategy: "round_robin",
  fixed_owner_user_id: null,
  dedup_window_days: 30,
  manual_responded_sub_types: ["walk_in"],
  routing_max_open: null,
  routing_use_skills: true,
  routing_hot_to_fastest: true,
  status: "active",
  archived_at: null,
  created_at: iso(now() - 4 * 24 * 60 * min),
}));

export const sources: S["Source"][] = clients.flatMap((c) => [
  {
    id: id(),
    client_id: c.id,
    kind: "web_form" as const,
    name: "Website form",
    status: "active" as const,
    public_key: faker.string.alphanumeric(32),
    endpoint_url: `http://localhost:8080/v1/ingest/forms/${faker.string.alphanumeric(32)}`,
    allowed_origins: [],
    requires_signature: false,
    otp_required: false,
    inbound_address: null,
    last_received_at: iso(now() - 7 * min),
    created_at: iso(now() - 4 * 24 * 60 * min),
  },
  {
    id: id(),
    client_id: c.id,
    kind: "meta_lead_ads" as const,
    name: "Meta: Eid offer",
    status: "active" as const,
    public_key: null,
    endpoint_url: null,
    allowed_origins: [],
    requires_signature: false,
    otp_required: false,
    inbound_address: null,
    last_received_at: iso(now() - 3 * min),
    created_at: iso(now() - 4 * 24 * 60 * min),
  },
]);

const campaigns = ["Eid Implant Offer", "Teeth Whitening Nov", "Flat Booking Dhamaka", "Winter Collection"].map(
  (name) => ({ id: id(), name }),
);

const agents = members.filter((m) => m.role === "agent");

export const leads: (S["LeadDetail"] & { section?: string })[] = [];
export const activities = new Map<string, S["Activity"][]>();
export const sales = new Map<string, S["Sale"][]>();

function makeLead(i: number): S["LeadDetail"] {
  const client = clients[i % clients.length]!;
  const src = sources.filter((s) => s.client_id === client.id)[i % 2]!;
  const ageMin =
    i < 4
      ? faker.number.int({ min: 17, max: 90 })
      : i < 8
        ? faker.number.int({ min: 11, max: 14 })
        : faker.number.int({ min: 1, max: 60 * 24 * 20 });
  const received = now() - ageMin * min;
  const stage =
    i < 14
      ? "new"
      : faker.helpers.weightedArrayElement([
          { value: "contacted" as const, weight: 4 },
          { value: "qualified" as const, weight: 2 },
          { value: "won" as const, weight: 2 },
          { value: "lost" as const, weight: 2 },
        ]);
  const responded = stage !== "new" ? received + faker.number.int({ min: 2, max: 40 }) * min : null;
  const due = received + 15 * min;
  const callback = stage === "contacted" && i % 3 === 0 ? now() + faker.number.int({ min: 30, max: 300 }) * min : null;
  const sla: S["LeadSLA"] | null =
    stage === "new"
      ? {
          status: due < now() ? "overdue" : due - now() < 5 * min ? "due_soon" : "on_track",
          due_at: iso(due),
          kind: "first_response",
        }
      : stage === "won" || stage === "lost"
        ? null
        : { status: "met", due_at: null, kind: "first_response" };
  const owner = i % 5 === 4 ? null : agents[i % agents.length]!.user.id;
  const name = personName();
  const phone = bdPhone();
  const campaign = src.kind === "meta_lead_ads" || i % 2 === 0 ? campaigns[i % campaigns.length]! : null;
  return {
    id: id(),
    client_id: client.id,
    source_id: src.id,
    campaign,
    full_name: name,
    phone,
    phone_raw: phone.display,
    email: i % 4 === 0 ? `${faker.internet.username().toLowerCase()}@gmail.com` : null,
    stage,
    lost_reason: stage === "lost" ? "price" : null,
    owner_user_id: owner,
    assigned_at: owner ? iso(received + min) : null,
    received_at: iso(received),
    stage_changed_at: iso(responded ?? received),
    first_attempt_at: responded ? iso(responded) : null,
    first_response_at: responded ? iso(responded) : null,
    last_activity_at: responded ? iso(responded) : null,
    next_callback_at: callback ? iso(callback) : null,
    qualified_at: stage === "qualified" || stage === "won" ? iso((responded ?? received) + 60 * min) : null,
    won_at: stage === "won" ? iso((responded ?? received) + 3 * 60 * min) : null,
    lost_at: stage === "lost" ? iso((responded ?? received) + 3 * 60 * min) : null,
    priority: 0,
    duplicate_count: i % 9 === 0 ? 1 : 0,
    previous_lead_id: null,
    deal_value:
      stage === "won" ? { amount_minor: faker.number.int({ min: 50, max: 900 }) * 10_000, currency: "BDT" } : null,
    utm: campaign
      ? { utm_source: src.kind === "meta_lead_ads" ? "facebook" : "google", utm_campaign: campaign.name }
      : {},
    custom_fields: i % 3 === 0 ? { "which_service?": "Implant" } : {},
    score: mockScore(i, stage, !!responded, !!callback),
    consent: i % 2 === 0 ? { whatsapp_opt_in: true, consent_text: "WhatsApp-এ যোগাযোগে সম্মতি দিচ্ছি" } : {},
    sla: i % 11 === 5 ? null : sla,
    quality:
      i % 11 === 5
        ? {
            status: "junk",
            score: 30,
            reasons: ["phone_pattern"],
            source: "rules",
            rules_version: "q1",
            verified_at: null,
            labeled_at: null,
          }
        : i % 7 === 3
          ? {
              status: "suspect",
              score: 65,
              reasons: ["garbage_name"],
              source: "rules",
              rules_version: "q1",
              verified_at: null,
              labeled_at: null,
            }
          : i % 6 === 0 && src.kind === "web_form"
            ? {
                status: "valid",
                score: 100,
                reasons: [],
                source: "otp",
                rules_version: "q1",
                verified_at: iso(received),
                labeled_at: null,
              }
            : {
                status: "valid",
                score: 100,
                reasons: [],
                source: "rules",
                rules_version: "q1",
                verified_at: null,
                labeled_at: null,
              },
    phone_country: "BD",
    do_not_contact: i === 7,
    version: 1,
    created_at: iso(received),
    updated_at: iso(responded ?? received),
    submissions: [
      {
        id: id(),
        source_id: src.id,
        is_duplicate: false,
        payload: { name, phone: phone.display },
        received_at: iso(received),
      },
    ],
    touchpoints: [],
  };
}

for (let i = 0; i < 120; i++) {
  const l = makeLead(i);
  leads.push(l);
  const acts: S["Activity"][] = [];
  if (l.first_response_at) {
    acts.push({
      id: id(),
      lead_id: l.id,
      actor_user_id: l.owner_user_id,
      type: "call",
      channel: "phone",
      direction: "outbound",
      outcome: l.next_callback_at ? "callback_requested" : "connected",
      body: l.next_callback_at ? "বিকেলে আবার কল করতে বলেছেন" : "",
      meta: {},
      counts_as_attempt: true,
      counts_as_response: true,
      occurred_at: l.first_response_at,
      created_at: l.first_response_at,
    });
  }
  activities.set(l.id, acts);
  if (l.stage === "won" && l.deal_value) {
    sales.set(l.id, [
      {
        id: id(),
        lead_id: l.id,
        client_id: l.client_id,
        amount: l.deal_value,
        sold_at: l.won_at!,
        source: "manual",
        external_ref: null,
        note: "",
        campaign_id: l.campaign?.id ?? null,
        owner_user_id: l.owner_user_id,
        recorded_by: l.owner_user_id,
        voided_at: null,
        created_at: l.won_at!,
      },
    ]);
  }
}

export function inboxSection(
  l: S["Lead"],
): "overdue" | "due_soon" | "callback_due" | "new" | "unassigned" | "in_progress" {
  if (l.sla?.status === "overdue" || (l.sla?.due_at && Date.parse(l.sla.due_at) < now())) return "overdue";
  if (l.sla?.status === "due_soon" || (l.sla?.due_at && Date.parse(l.sla.due_at) - now() < 5 * min)) return "due_soon";
  if (l.next_callback_at && Date.parse(l.next_callback_at) < now() + 12 * 60 * min) return "callback_due";
  if (l.stage === "new") return l.owner_user_id ? "new" : "unassigned";
  return "in_progress";
}

export const notifications: S["Notification"][] = leads
  .filter((l) => l.sla?.status === "overdue")
  .slice(0, 3)
  .map((l, i) => ({
    id: id(),
    type: "sla.breached",
    title: `সময় পেরিয়ে গেছে: ${l.full_name}`,
    body: `${l.full_name} (${clients.find((c) => c.id === l.client_id)?.name})-এর সাথে সময়মতো যোগাযোগ হয়নি।`,
    lead_id: l.id,
    data: {},
    read_at: null,
    created_at: iso(now() - (i + 1) * 4 * min),
  }));

/** Consent ledger rows recorded in the mock (the form baseline comes from lead.consent). */
export const consentEvents = new Map<string, S["ConsentEvent"][]>();

export const slaPolicies = new Map<string, S["SLAPolicy"]>();
for (const c of clients) {
  slaPolicies.set(c.id, {
    active: true,
    first_response_minutes: 15,
    business_hours_only: true,
    measure: "attempt",
    warn_at_percent: 80,
    follow_up_rules: { contacted: 60 },
    junk_sla: false,
    escalation_ladder: [
      { level: 1, after_breach_minutes: 0, notify: ["owner", "client_managers"] },
      { level: 2, after_breach_minutes: 60, notify: ["agency_admins"] },
    ],
    is_default: false,
  });
}

export const reports: S["Report"][] = [];
export const shares = new Map<string, S["ReportShare"][]>();

// 17.0.4: an email-in source with two forwarded emails waiting for review, and a Messenger lead.
const demoClient = clients[0]!;
sources.push(
  {
    id: id(),
    client_id: demoClient.id,
    kind: "email_in",
    name: "Email forwarding",
    status: "active",
    public_key: null,
    endpoint_url: null,
    allowed_origins: [],
    requires_signature: false,
    otp_required: false,
    inbound_address: `leads+${faker.string.hexadecimal({ length: 44, casing: "lower", prefix: "" })}@in.recov.app`,
    last_received_at: iso(now() - 25 * min),
    created_at: iso(now() - 2 * 24 * 60 * min),
  },
  {
    id: id(),
    client_id: demoClient.id,
    kind: "messenger",
    name: "Messenger · Dhaka Dental Care",
    status: "active",
    public_key: null,
    endpoint_url: null,
    allowed_origins: [],
    requires_signature: false,
    otp_required: false,
    inbound_address: null,
    last_received_at: iso(now() - 40 * min),
    created_at: iso(now() - 2 * 24 * 60 * min),
  },
);
const emailSource = sources.at(-2)!;

export const reviewItems: S["ReviewItem"][] = [
  {
    id: id(),
    client_id: demoClient.id,
    source_id: emailSource.id,
    received_at: iso(now() - 25 * min),
    from: "Farhana Akter <farhana.akter@gmail.com>",
    subject: "Fwd: implant price?",
    body: "Hello, I saw your Facebook post about implants. How much is it?\nPlease call me on 01712-345678 after 5pm.\n\nThanks,\nFarhana",
    fields: { phone: "+8801712345678", full_name: "" },
    confidence: 0.45,
    parser: "generic+regex",
  },
  {
    id: id(),
    client_id: demoClient.id,
    source_id: emailSource.id,
    received_at: iso(now() - 3 * 60 * min),
    from: "Bayut <no-reply@bayut.com>",
    subject: "New lead for your listing",
    body: "Customer Name: Omar Haddad\nMobile: +971 50 123 4567\nMessage: Is the 2-bed still available?",
    fields: { full_name: "Omar Haddad", phone: "+971501234567", message: "Is the 2-bed still available?" },
    confidence: 0.65,
    parser: "template:bayut",
  },
];

export const conversations = new Map<string, S["Conversation"][]>();
{
  const dm = leads.find((l) => l.client_id === demoClient.id && l.stage === "new")!;
  const src = sources.at(-1)!;
  dm.source_id = src.id;
  dm.custom_fields = { source_detail: "messenger" };
  dm.full_name = "Sadia Islam";
  const at = now() - 40 * min;
  activities.set(dm.id, [
    ...[
      ["দাম কত? whitening করাতে চাই", at - 2 * min],
      ["আমার নম্বর ০১৭১১২২৩৩৪৪", at],
    ].map(([body, t]) => ({
      id: id(),
      lead_id: dm.id,
      actor_user_id: null,
      type: "messenger" as const,
      channel: "messenger",
      direction: "inbound" as const,
      outcome: null,
      body: String(body),
      meta: {},
      counts_as_attempt: false,
      counts_as_response: false,
      occurred_at: iso(Number(t)),
      created_at: iso(Number(t)),
    })),
    ...(activities.get(dm.id) ?? []),
  ]);
  conversations.set(dm.id, [
    {
      id: id(),
      channel: "messenger",
      last_inbound_at: iso(at),
      window_expires_at: iso(at + 24 * 60 * min),
      window_open: true,
    },
  ]);
}

export { id as newId, iso, now };

// Step 3a: the shared inbox, a WhatsApp number with templates, and messaging settings.
export const channelAccounts: S["ChannelAccount"][] = [
  {
    id: id(),
    client_id: demoClient.id,
    channel: "whatsapp",
    provider: "whatsapp_cloud",
    external_id: "109876543210",
    display_name: "+880 1711-000000",
    status: "active",
    created_at: iso(now() - 3 * 24 * 60 * min),
  },
];
export const messageTemplates: S["MessageTemplate"][] = [
  {
    id: id(),
    channel_account_id: channelAccounts[0]!.id,
    name: "lead_welcome",
    language: "en",
    category: "utility",
    body: "Hi {{1}}, thanks for contacting {{2}}. When is a good time to call you?",
    variables: ["lead.first_name", "client.name"],
    status: "approved",
  },
  {
    id: id(),
    channel_account_id: channelAccounts[0]!.id,
    name: "lead_welcome",
    language: "bn",
    category: "utility",
    body: "আসসালামু আলাইকুম {{1}}, {{2}}-এ যোগাযোগের জন্য ধন্যবাদ। কখন কল করলে সুবিধা হবে?",
    variables: ["lead.first_name", "client.name"],
    status: "approved",
  },
  {
    id: id(),
    channel_account_id: channelAccounts[0]!.id,
    name: "eid_offer",
    language: "bn",
    category: "marketing",
    body: "ঈদ অফার! {{1}}, এই সপ্তাহে ২০% ছাড়।",
    variables: ["lead.first_name"],
    status: "pending",
  },
];
export const messagingSettings: S["MessagingSettings"] = { paused: false, auto_reply_counts_sla: false };

export const inbox: S["InboxConversation"][] = [];
export const inboxMessages = new Map<string, S["Message"][]>();
{
  const waLeads = leads.filter((l) => l.client_id === demoClient.id && l.phone && !l.do_not_contact).slice(0, 4);
  const lines: [string, string][] = [
    ["inbound", "দাম কত? ডেলিভারি আছে?"],
    ["outbound", "জি আছে, ঢাকার ভেতরে ফ্রি ডেলিভারি। কোন সার্ভিসটি চান?"],
    ["inbound", "Implant, next week possible?"],
  ];
  waLeads.forEach((l, i) => {
    const convId = id();
    const last = now() - (i * 50 + 5) * min;
    const open = i < 2;
    const msgs: S["Message"][] = lines.slice(0, i === 3 ? 1 : 3).map(([dir, body], j) => ({
      id: id(),
      conversation_id: convId,
      lead_id: l.id,
      channel: "whatsapp",
      direction: dir as "inbound" | "outbound",
      kind: "text",
      body,
      template_name: null,
      status: dir === "inbound" ? "received" : "read",
      error: null,
      sent_by: dir === "inbound" ? null : l.owner_user_id,
      automated: false,
      activity_id: null,
      created_at: iso(last - (2 - j) * 3 * min),
      sent_at: dir === "inbound" ? null : iso(last - (2 - j) * 3 * min),
      delivered_at: null,
      read_at: null,
    }));
    inboxMessages.set(convId, msgs.reverse());
    const lastMsg = msgs[0]!;
    inbox.push({
      id: convId,
      client_id: l.client_id,
      channel: "whatsapp",
      lead: {
        id: l.id,
        name: l.full_name,
        owner_user_id: l.owner_user_id,
        stage: l.stage,
        phone: l.phone?.e164 ?? null,
      },
      last_message_at: lastMsg.created_at,
      last_message_preview: lastMsg.body,
      last_direction: lastMsg.direction,
      unread_count: lastMsg.direction === "inbound" ? 1 : 0,
      window_expires_at: iso(open ? last + 24 * 60 * min : last - 26 * 60 * min),
      window_open: open,
      claimed_by: i === 1 ? (agents[1]?.user.id ?? null) : null,
      claimed_until: i === 1 ? iso(now() + 2 * min) : null,
    });
  });
}

// Step 3b: an auto-responder (off) with some recent decisions to show.
export const autoResponder: S["AutoResponderView"] = {
  enabled: false,
  channel: "whatsapp",
  template_name: null,
  template_language: null,
  sms_text: "",
  delay_seconds: 30,
  estimate: {
    leads_last_30_days: 120,
    price_per_message: 0.011,
    monthly_cost: 1.32,
    currency: "USD",
    price_list_verified: "approximate",
  },
  recent_runs: leads
    .filter((l) => l.client_id === demoClient.id)
    .slice(0, 3)
    .map((l, i) => ({
      lead_id: l.id,
      lead_name: l.full_name,
      status: (["sent", "skipped", "deferred"] as const)[i]!,
      reason: [null, "contact_not_allowed", "contact_deferred"][i] ?? null,
      defer_until: i === 2 ? iso(now() + 9 * 60 * min) : null,
      at: iso(now() - (i + 1) * 7 * min),
    })),
};

// Step 3c: a Twilio number for click-to-call, call settings, and a few calls with a recording and AI notes.
export const voiceNumbers: S["VoiceNumber"][] = [
  {
    id: id(),
    client_id: demoClient.id,
    provider: "twilio",
    number: "+8809610000001",
    external_id: "AC0000000000000000000000000000demo",
    webhook_url: null,
    status: "active",
    created_at: iso(now() - 5 * 24 * 60 * min),
  },
];
export const callSettings: S["CallSettings"] = {
  record_calls: true,
  recording_notice: "This call may be recorded for quality.",
  retention_days: 90,
};
export const myCallPhone: S["CallPhone"] = { phone: "+8801711000099" };
export const calls: S["Call"][] = [];
{
  const callLeads = leads.filter((l) => l.client_id === demoClient.id && l.phone && !l.do_not_contact).slice(0, 3);
  const base = (l: (typeof callLeads)[number], i: number): S["Call"] => ({
    id: id(),
    client_id: l.client_id,
    lead_id: l.id,
    lead_name: l.full_name ?? "",
    direction: "outbound",
    status: "completed",
    from: voiceNumbers[0]!.number,
    to: l.phone!.e164,
    agent_user_id: me.user.id,
    provider: "twilio",
    started_at: iso(now() - (i * 90 + 20) * min),
    answered_at: iso(now() - (i * 90 + 20) * min),
    ended_at: iso(now() - (i * 90 + 18) * min),
    duration_seconds: 0,
    recording_status: "none",
    recording_seconds: 0,
    transcript_status: "none",
    transcript: [],
    summary: null,
    activity_id: null,
  });
  const [a, b, c] = callLeads;
  if (a)
    calls.push({
      ...base(a, 0),
      duration_seconds: 134,
      recording_status: "stored",
      recording_seconds: 134,
      transcript_status: "done",
      transcript: [
        {
          speaker: "agent",
          start: 0,
          end: 9,
          text: "আসসালামু আলাইকুম, ডেন্টাল কেয়ার থেকে বলছি। আপনি ইমপ্লান্ট নিয়ে জানতে চেয়েছিলেন?",
        },
        { speaker: "lead", start: 9, end: 17, text: "জি, কিন্তু দাম একটু বেশি মনে হচ্ছে।" },
        {
          speaker: "agent",
          start: 17,
          end: 31,
          text: "We have an EMI plan over six months. Can you come for a free check-up on Saturday?",
        },
        { speaker: "lead", start: 31, end: 36, text: "Saturday evening works." },
      ],
      summary: {
        summary: "Interested in an implant; worried about the price. Agreed to a free check-up on Saturday evening.",
        intent: "Dental implant",
        budget: "Price-sensitive, open to EMI",
        timeline: "This week",
        objections: ["Price too high"],
        next_step: "Confirm the Saturday evening check-up",
        sentiment: "positive",
        suggested_stage: "qualified",
      },
    });
  if (b) calls.push({ ...base(b, 1), status: "no_answer", answered_at: null });
  if (c)
    calls.push({
      ...base(c, 2),
      direction: "inbound",
      status: "missed",
      from: c.phone!.e164,
      to: voiceNumbers[0]!.number,
      agent_user_id: null,
      provider: "pbx",
      answered_at: null,
    });
}
export const coaching: S["AgentCoaching"][] = [
  {
    user_id: me.user.id,
    calls: 18,
    connected: 11,
    avg_duration_seconds: 142,
    talk_ratio: 0.58,
    top_objections: [
      { text: "price too high", count: 5 },
      { text: "too far from home", count: 2 },
    ],
  },
  ...agents.slice(0, 2).map((m, i) => ({
    user_id: m.user.id,
    calls: 12 - i * 4,
    connected: 6 - i * 2,
    avg_duration_seconds: 98 + i * 20,
    talk_ratio: i === 0 ? 0.71 : null,
    top_objections: i === 0 ? [{ text: "call back later", count: 3 }] : [],
  })),
];

// Step 4a: recovery sequences — one running (with results), one draft.
export const sequences: S["Sequence"][] = [
  {
    id: id(),
    client_id: demoClient.id,
    name: "No answer twice → WhatsApp",
    status: "active",
    trigger: { kind: "no_answer", attempts: 2 },
    steps: [
      { type: "whatsapp_template", template_name: "lead_welcome", template_language: "bn" },
      { type: "wait", hours: 48 },
      { type: "call_task", note: "Call back with the EMI offer" },
    ],
    exit_on: ["reply", "stage_changed", "sale", "opt_out"],
    holdout_percent: 10,
    version: 3,
    activated_at: iso(now() - 20 * 24 * 60 * min),
    created_at: iso(now() - 21 * 24 * 60 * min),
    updated_at: iso(now() - 2 * 24 * 60 * min),
  },
  {
    id: id(),
    client_id: demoClient.id,
    name: "Lost on price — 14 days later",
    status: "draft",
    trigger: { kind: "lost", reasons: ["price"], days: 14 },
    steps: [
      { type: "sms", text: "Hi {first_name}, {client} has a new EMI plan this month. Reply STOP to opt out." },
      { type: "wait", hours: 72 },
      { type: "ai_draft", note: "Offer the free check-up" },
    ],
    exit_on: ["reply", "stage_changed", "sale", "opt_out"],
    holdout_percent: 10,
    version: 1,
    activated_at: null,
    created_at: iso(now() - 3 * 24 * 60 * min),
    updated_at: iso(now() - 3 * 24 * 60 * min),
  },
];
export const recovered: S["RecoveredRevenue"] = {
  currency: "BDT",
  treated_leads: 186,
  holdout_leads: 21,
  treated_converted: 23,
  holdout_converted: 1,
  treated_revenue_minor: 23_450_000,
  holdout_revenue_minor: 120_000,
  treated_conversion_rate: 23 / 186,
  holdout_conversion_rate: 1 / 21,
  incremental_revenue_minor: 23_450_000 - Math.round((120_000 * 186) / 21),
  complete: true,
  missing_currencies: [],
};
export const enrollments: S["SequenceEnrollment"][] = leads
  .filter((l) => l.client_id === demoClient.id && l.phone && !l.do_not_contact)
  .slice(3, 7)
  .map((l, i) => ({
    id: id(),
    sequence_id: sequences[0]!.id,
    sequence_name: sequences[0]!.name,
    lead_id: l.id,
    lead_name: l.full_name ?? "",
    status: i === 0 ? "active" : i === 1 ? "holdout" : "exited",
    step_no: i === 0 ? 1 : 0,
    step_count: 3,
    next_step: i === 0 ? { type: "wait", hours: 48 } : null,
    next_step_at: i === 0 ? iso(now() + 30 * 60 * min) : null,
    exit_reason: i === 2 ? "reply" : i === 3 ? "sale" : null,
    enrolled_by: null,
    enrolled_at: iso(now() - (i + 1) * 26 * 60 * min),
    ended_at: i >= 2 ? iso(now() - i * 60 * min) : null,
  }));

// Step 4b: automation rules — one running with a log, one switched off.
export const rules: S["AutomationRule"][] = [
  {
    id: id(),
    name: "Meta implant leads → best closer",
    client_id: demoClient.id,
    event: "lead.created",
    conditions: {
      match: "all",
      rules: [
        { field: "lead.source_kind", op: "eq", value: "meta_lead_ads" },
        { field: "custom.service", op: "contains", value: "implant" },
      ],
    },
    actions: [
      { type: "assign", user_id: agents[0]?.user.id ?? me.user.id },
      { type: "tag", tags: ["implant", "vip"] },
      { type: "notify", to: ["owner"], message: "Implant lead — call within 5 minutes" },
    ],
    rate_per_hour: 100,
    enabled: true,
    version: 2,
    webhook_secret: "whsec_3f9a0c1d2e4b5a6978c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
    last_24h: { fired: 14, no_match: 61 },
    created_at: iso(now() - 9 * 24 * 60 * min),
    updated_at: iso(now() - 2 * 24 * 60 * min),
  },
  {
    id: id(),
    name: "Missed SLA → tell the managers",
    client_id: null,
    event: "sla.breached",
    conditions: { match: "all", rules: [] },
    actions: [{ type: "notify", to: ["managers"], message: "A lead missed its first-response SLA" }],
    rate_per_hour: 50,
    enabled: false,
    version: 1,
    webhook_secret: "whsec_8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a392817",
    last_24h: {},
    created_at: iso(now() - 1 * 24 * 60 * min),
    updated_at: iso(now() - 1 * 24 * 60 * min),
  },
];
export const ruleRuns: S["AutomationRun"][] = leads
  .filter((l) => l.client_id === demoClient.id)
  .slice(0, 4)
  .map((l, i) => ({
    id: id(),
    rule_version: 2,
    event_id: id(),
    event_type: "lead.created",
    lead_id: l.id,
    lead_name: l.full_name ?? "",
    depth: 0,
    status: i % 2 === 0 ? "fired" : "no_match",
    explain: [
      {
        field: "lead.source_kind",
        op: "eq",
        value: "meta_lead_ads",
        actual: i % 2 === 0 ? "meta_lead_ads" : "web_form",
        result: i % 2 === 0,
      },
      { field: "custom.service", op: "contains", value: "implant", actual: "Dental implant", result: true },
    ],
    results:
      i % 2 === 0
        ? [
            { type: "assign", status: "done" },
            { type: "tag", status: "done" },
            { type: "notify", status: "done", detail: "1" },
          ]
        : [],
    created_at: iso(now() - (i + 1) * 47 * min),
  }));

// ---------------------------------------------------------------------------------------------
// Security (17.6). The mock accepts 123456 as every authenticator-app code.

export const security: S["SecurityOverview"] = {
  totp_enabled: false,
  passkeys: [],
  passkeys_available: true,
  recovery_codes_remaining: 0,
  login_alerts: true,
  has_email: true,
  session_verified: false,
  required_by: [],
  recent_events: [
    {
      id: id(),
      kind: "login",
      ip: "103.4.145.2",
      country: "BD",
      device: { browser: "Chrome", os: "Windows" },
      detail: { method: "password", mfa: false, new_device: false, new_country: false },
      created_at: iso(now() - 20 * min),
    },
    {
      id: id(),
      kind: "login",
      ip: "103.4.145.9",
      country: "BD",
      device: { browser: "Safari", os: "iOS" },
      detail: { method: "password", mfa: false, new_device: true, new_country: false },
      created_at: iso(now() - 2 * 24 * 60 * min),
    },
  ],
};

export const sessions: S["Session"][] = [
  {
    id: id(),
    current: true,
    device: { browser: "Chrome", os: "Windows" },
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0",
    ip: "103.4.145.2",
    country: "BD",
    auth_method: "password",
    mfa: false,
    remembered: false,
    started_at: iso(now() - 20 * min),
    last_seen_at: iso(now() - 2 * min),
    expires_at: iso(now() + 30 * 24 * 60 * min),
  },
  {
    id: id(),
    current: false,
    device: { browser: "Safari", os: "iOS" },
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Safari/604.1",
    ip: "103.4.145.9",
    country: "BD",
    auth_method: "password",
    mfa: false,
    remembered: true,
    started_at: iso(now() - 2 * 24 * 60 * min),
    last_seen_at: iso(now() - 5 * 60 * min),
    expires_at: iso(now() + 88 * 24 * 60 * min),
  },
];

export const recoveryCodes = [
  "k7m2p-x9q4r",
  "a3f8w-n6t2h",
  "z5c9e-u7y3b",
  "d2g6j-m8v4s",
  "p9r3x-h5k7w",
  "e4t8n-q2c6f",
  "w7b3y-j9m5u",
  "s6h2k-v4x8a",
  "c8p5r-t3z7g",
  "n2w9e-f6d4q",
];

// ---------------------------------------------------------------------------------------------
// Lead-source connectors (G5, step 5a): Google Ads lead forms for the first client (healthy, with a test lead in
// the log) and a Typeform webhook for the second one (degraded: the last two posts had no contact field).

const TARGETS = [
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "email",
  "message",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "referrer",
  "landing_page",
  "whatsapp_opt_in",
  "marketing_opt_in",
  "consent_text",
  "_ignore",
];

export const connectorCatalog: S["ConnectorManifest"][] = [
  {
    key: "google_ads",
    source_kind: "google_ads",
    name: "Google Ads",
    category: "ads",
    auth: "shared_key",
    capabilities: ["source"],
    mappable: true,
    docs_url: "https://support.google.com/google-ads/answer/9423234",
    targets: TARGETS,
  },
  {
    key: "webhook",
    source_kind: "webhook",
    name: "Webhook",
    category: "forms",
    auth: "url_secret",
    capabilities: ["source"],
    mappable: true,
    docs_url: "",
    targets: TARGETS,
  },
  {
    key: "inbound_api",
    source_kind: "api",
    name: "Inbound Lead API",
    category: "developer",
    auth: "api_key",
    capabilities: ["source"],
    mappable: true,
    docs_url: "",
    targets: TARGETS,
  },
];

function connectorSource(clientId: string, kind: "google_ads" | "webhook" | "api", name: string): S["Source"] {
  const s: S["Source"] = {
    id: id(),
    client_id: clientId,
    kind,
    name,
    status: "active",
    public_key: null,
    endpoint_url: null,
    allowed_origins: [],
    requires_signature: false,
    otp_required: false,
    inbound_address: null,
    last_received_at: null,
    created_at: iso(now()),
  };
  sources.push(s);
  return s;
}

export function newConnectorInstall(connector: string, clientId: string, name: string): S["ConnectorInstallDetail"] {
  const m = connectorCatalog.find((x) => x.key === connector)!;
  const src = connectorSource(clientId, m.source_kind as "google_ads" | "webhook" | "api", name);
  const ingress = faker.string.alphanumeric(22);
  return {
    id: id(),
    client_id: clientId,
    source_id: src.id,
    connector,
    name,
    status: "active",
    field_map: {},
    settings: {},
    health: "pending",
    consecutive_failures: 0,
    last_success_at: null,
    last_failure_at: null,
    last_error: null,
    endpoint:
      connector === "inbound_api"
        ? "http://localhost:8080/v1/inbound/leads"
        : connector === "webhook"
          ? `http://localhost:8080/v1/connectors/webhook/${ingress.slice(0, 8)}…`
          : `http://localhost:8080/v1/connectors/google-ads/${ingress}`,
    created_at: iso(now()),
    last_24h: {},
    deliveries: [],
  };
}

export function connectorCredentials(i: S["ConnectorInstall"]): S["ConnectorCredentials"] {
  const secret = faker.string.alphanumeric(32);
  if (i.connector === "google_ads") return { endpoint: i.endpoint, key: secret, key_label: "google_key" };
  if (i.connector === "inbound_api") {
    const key = `rk.${faker.string.alphanumeric(22)}.${secret}`;
    return {
      endpoint: i.endpoint,
      key,
      key_label: "api_key",
      example:
        `curl -X POST ${i.endpoint} \\n  -H 'Authorization: Bearer ${key}' \\n` +
        `  -H 'Idempotency-Key: your-lead-id-123' -H 'Content-Type: application/json' \\n` +
        `  -d '{"full_name":"Test Lead","phone":"+15550100","email":"test@example.com","test":true}'`,
    };
  }
  return { endpoint: i.endpoint.replace("…", faker.string.alphanumeric(30)), key_label: "url" };
}

export const connectorInstalls: S["ConnectorInstallDetail"][] = [];
{
  const g = newConnectorInstall("google_ads", clients[0]!.id, "Google Ads: Implant search");
  const accepted = (n: number): S["ConnectorDelivery"] => ({
    id: id(),
    received_at: iso(now() - (n * 53 + 6) * min),
    result: "accepted",
    external_id: `TeSter-${faker.string.numeric(12)}`,
    inbound_event_id: id(),
    error: null,
    preview: null,
  });
  Object.assign(g, {
    health: "healthy",
    last_success_at: iso(now() - 6 * min),
    last_24h: { accepted: 9, duplicate: 1, test: 1 },
    deliveries: [
      ...Array.from({ length: 5 }, (_, n) => accepted(n)),
      {
        id: id(),
        received_at: iso(now() - 26 * 60 * min),
        result: "test",
        external_id: "TeSter-000000000000",
        inbound_event_id: null,
        error: null,
        preview: { full_name: "FirstName LastName", phone: "+16505550123", email: "test@example.com", gclid: "TeSt" },
      },
    ],
  });
  connectorInstalls.push(g);
  const w = newConnectorInstall("webhook", clients[1]!.id, "Typeform: Site visit booking");
  Object.assign(w, {
    health: "degraded",
    consecutive_failures: 2,
    field_map: { "answers.0.text": "full_name", "answers.1.phone_number": "phone", "hidden.budget": "custom.budget" },
    settings: { id_field: "event_id" },
    last_success_at: iso(now() - 3 * 60 * min),
    last_failure_at: iso(now() - 12 * min),
    last_error: "No phone or email in the submission.",
    last_24h: { accepted: 4, rejected: 2 },
    deliveries: [
      {
        id: id(),
        received_at: iso(now() - 12 * min),
        result: "rejected",
        external_id: null,
        inbound_event_id: null,
        error: "No phone or email in the submission.",
        preview: null,
      },
      {
        id: id(),
        received_at: iso(now() - 41 * min),
        result: "rejected",
        external_id: null,
        inbound_event_id: null,
        error: "No phone or email in the submission.",
        preview: null,
      },
      {
        id: id(),
        received_at: iso(now() - 3 * 60 * min),
        result: "accepted",
        external_id: "01J9Z4",
        inbound_event_id: id(),
        error: null,
        preview: null,
      },
    ],
  });
  connectorInstalls.push(w);
}

// ---------------------------------------------------------------------------------------------
// Conversion feedback + spend sync (step 5b): the first client accepted the terms and sends to a Meta dataset
// (healthy) and a Google Ads account (failing: a removed conversion action); one Meta ad account syncs spend.

export const googleConnections: S["GoogleConnection"][] = [
  {
    id: id(),
    email: "ads@agency.example",
    status: "active",
    last_error: null,
    created_at: iso(now() - 9 * 24 * 60 * min),
  },
];

export const conversionSettings = new Map<string, S["ConversionSettings"]>([
  [
    clients[0]!.id,
    { accepted: true, accepted_at: iso(now() - 6 * 24 * 60 * min), accepted_by: me.user.id, terms_version: "dp1" },
  ],
]);

function destination(
  clientId: string,
  platform: "meta" | "google_ads",
  extra: Partial<S["ConversionDestination"]>,
): S["ConversionDestination"] {
  return {
    id: id(),
    client_id: clientId,
    platform,
    name: platform === "meta" ? "Meta dataset" : "Google Ads",
    status: "active",
    dataset_id: platform === "meta" ? "418273645512983" : null,
    has_access_token: platform === "meta",
    test_event_code: null,
    google_connection_id: platform === "google_ads" ? googleConnections[0]!.id : null,
    customer_id: platform === "google_ads" ? "1234567890" : null,
    login_customer_id: null,
    mapping:
      platform === "meta"
        ? { "stage.contacted": "Contacted", "stage.qualified": "Qualified", "stage.won": "Won" }
        : { "stage.won": "customers/1234567890/conversionActions/111" },
    send_value: true,
    health: "healthy",
    consecutive_failures: 0,
    last_success_at: iso(now() - 14 * min),
    last_failure_at: null,
    last_error: null,
    created_at: iso(now() - 6 * 24 * 60 * min),
    ...extra,
  };
}

export const destinations: S["ConversionDestination"][] = [
  destination(clients[0]!.id, "meta", { name: "Meta: Dhaka Dental pixel" }),
  destination(clients[0]!.id, "google_ads", {
    name: "Google Ads: Dental Search",
    health: "degraded",
    consecutive_failures: 2,
    last_failure_at: iso(now() - 30 * min),
    last_error: "The conversion action was not found or is not enabled. (NO_CONVERSION_ACTION_FOUND)",
  }),
];

export const conversionEvents = new Map<string, S["ConversionEvent"][]>();
for (const d of destinations) {
  const rows: S["ConversionEvent"][] = leads.slice(0, 14).map((l, i) => {
    const status: S["ConversionEvent"]["status"] =
      d.platform === "google_ads" && i < 2 ? "failed" : i === 5 ? "skipped" : i === 9 ? "skipped" : "sent";
    const trigger =
      d.platform === "google_ads"
        ? "stage.won"
        : (["stage.contacted", "stage.qualified", "stage.won"] as const)[i % 3]!;
    return {
      id: id(),
      lead_id: l.id,
      trigger,
      event_name: d.mapping[trigger] ?? "",
      event_time: iso(now() - (i + 1) * 97 * min),
      status,
      skip_reason: status === "skipped" ? (i === 5 ? "policy:marketing_refused" : "junk") : null,
      value_minor: trigger === "stage.won" && status === "sent" ? 2_500_000 : null,
      currency: trigger === "stage.won" && status === "sent" ? "BDT" : null,
      match_keys:
        d.platform === "meta"
          ? i % 4 === 0
            ? ["lead_id", "ph", "fn", "country"]
            : ["ph", "fn", "ln", "country"]
          : ["gclid", "ph"],
      attempts: status === "failed" ? 2 : 1,
      next_attempt_at: status === "failed" ? iso(now() + 25 * min) : null,
      last_error: status === "failed" ? d.last_error : null,
      sent_at: status === "sent" ? iso(now() - (i + 1) * 97 * min + 20_000) : null,
      policy_version: "cp2",
      created_at: iso(now() - (i + 1) * 97 * min),
    };
  });
  conversionEvents.set(d.id, rows);
}

export function conversionStats(destID: string): S["ConversionStats"] {
  const rows = conversionEvents.get(destID) ?? [];
  const by: Record<string, number> = {};
  const skips: Record<string, number> = {};
  const keys: Record<string, number> = {};
  for (const e of rows) {
    by[e.status] = (by[e.status] ?? 0) + 1;
    if (e.skip_reason) skips[e.skip_reason] = (skips[e.skip_reason] ?? 0) + 1;
    if (e.status === "sent") for (const k of e.match_keys) keys[k] = (keys[k] ?? 0) + 1;
  }
  const sent = by.sent ?? 0;
  const denied = Object.entries(skips)
    .filter(([k]) => k.startsWith("policy:"))
    .reduce((n, [, v]) => n + v, 0);
  const decided = sent + (by.failed ?? 0) + (by.dead ?? 0) + denied;
  return {
    days: 30,
    by_status: by,
    skip_reasons: skips,
    match_keys: keys,
    sent,
    consent_coverage: decided ? (decided - denied) / decided : null,
    last_sent_at: rows.find((e) => e.sent_at)?.sent_at ?? null,
  };
}

export const googleCustomers: S["GoogleCustomer"][] = [
  { id: "1234567890", name: "Dental Search", currency: "BDT", manager: false },
  { id: "9999999999", name: "Agency MCC", currency: "BDT", manager: true },
];

export const googleActions: S["GoogleConversionAction"][] = [
  {
    resource_name: "customers/1234567890/conversionActions/111",
    id: "111",
    name: "Won (offline)",
    type: "UPLOAD_CLICKS",
    status: "ENABLED",
  },
  {
    resource_name: "customers/1234567890/conversionActions/112",
    id: "112",
    name: "Qualified lead (offline)",
    type: "UPLOAD_CLICKS",
    status: "ENABLED",
  },
];

export const availableMetaAccounts: S["AvailableAdAccount"][] = [
  {
    platform: "meta",
    external_id: "act_1029384756",
    name: "Dhaka Dental Ads",
    currency: "BDT",
    connection_id: id(),
    manager: false,
  },
  {
    platform: "meta",
    external_id: "act_5647382910",
    name: "US Dental Ads",
    currency: "USD",
    connection_id: id(),
    manager: false,
  },
];

export const adAccounts: S["AdAccount"][] = [
  {
    id: id(),
    client_id: clients[0]!.id,
    platform: "meta",
    external_id: "act_1029384756",
    name: "Dhaka Dental Ads",
    currency: "BDT",
    meta_connection_id: availableMetaAccounts[0]!.connection_id,
    google_connection_id: null,
    login_customer_id: null,
    status: "active",
    health: "healthy",
    consecutive_failures: 0,
    last_synced_at: iso(now() - 3 * 60 * min),
    synced_through: iso(now()).slice(0, 10),
    last_error: null,
    created_at: iso(now() - 6 * 24 * 60 * min),
  },
];

export function newDestination(
  clientId: string,
  platform: "meta" | "google_ads",
  extra: Partial<S["ConversionDestination"]>,
) {
  return destination(clientId, platform, {
    health: "pending",
    last_success_at: null,
    created_at: iso(now()),
    ...extra,
  });
}

// Step 5c: the public API and outgoing webhooks. One seeded key, one endpoint with a short delivery log (one
// failure, so the log and resend can be demoed).
export const developerCatalog: S["DeveloperCatalog"] = {
  scopes: [
    {
      scope: "leads:read",
      routes: [
        "GET /v1/leads",
        "GET /v1/leads/{leadId}",
        "GET /v1/leads/{leadId}/activities",
        "GET /v1/leads/{leadId}/sales",
      ],
    },
    {
      scope: "leads:write",
      routes: [
        "PATCH /v1/leads/{leadId}",
        "POST /v1/leads",
        "POST /v1/leads/{leadId}/activities",
        "POST /v1/leads/{leadId}/assign",
        "POST /v1/leads/{leadId}/sales",
        "POST /v1/leads/{leadId}/stage",
      ],
    },
    {
      scope: "clients:read",
      routes: ["GET /v1/clients", "GET /v1/clients/{clientId}", "GET /v1/clients/{clientId}/campaigns"],
    },
    { scope: "reports:read", routes: ["GET /v1/dashboard"] },
    {
      scope: "webhooks:manage",
      routes: [
        "DELETE /v1/webhook-endpoints/{id}",
        "GET /v1/webhook-endpoints",
        "GET /v1/webhook-endpoints/{id}",
        "PATCH /v1/webhook-endpoints/{id}",
        "POST /v1/webhook-endpoints",
      ],
    },
  ],
  events: [
    "lead.created",
    "lead.assigned",
    "lead.stage_changed",
    "lead.updated",
    "lead.duplicate_received",
    "sale.recorded",
    "sale.voided",
    "sla.breached",
  ],
};

export const apiKeys: S["ApiKey"][] = [
  {
    id: id(),
    name: "HubSpot sync",
    scopes: ["leads:read", "clients:read"],
    hint: "x7Qa",
    status: "active",
    created_by: members[0]!.user.id,
    created_at: iso(now() - 12 * 24 * 60 * min),
    expires_at: null,
    last_used_at: iso(now() - 14 * min),
    revoked_at: null,
    app_key: null,
  },
];

export const webhookEndpoints: S["WebhookEndpoint"][] = [
  {
    id: id(),
    url: "https://hooks.zapier.com/hooks/catch/1234567/abcde/",
    description: "Zapier → Google Sheets",
    events: ["lead.created", "lead.stage_changed"],
    client_ids: [],
    status: "active",
    disabled_reason: null,
    consecutive_failures: 0,
    last_success_at: iso(now() - 9 * min),
    last_failure_at: iso(now() - 3 * 60 * min),
    created_via: "app",
    created_at: iso(now() - 20 * 24 * 60 * min),
  },
];

export const webhookDeliveries: S["WebhookDelivery"][] = [];

export function webhookDelivery(
  endpointId: string,
  eventType: string,
  ok: boolean,
  at: number,
  extra: Partial<S["WebhookDelivery"]> = {},
): S["WebhookDelivery"] {
  const eventId = id();
  return {
    id: id(),
    endpoint_id: endpointId,
    event_id: eventId,
    event_type: eventType,
    status: ok ? "succeeded" : "pending",
    attempts: 1,
    next_attempt_at: ok ? null : iso(at + 5 * min),
    response_status: ok ? 200 : 500,
    duration_ms: ok ? 182 : 1040,
    error: ok ? null : "the endpoint answered 500",
    replay_of: null,
    created_at: iso(at),
    finished_at: ok ? iso(at) : null,
    payload: {
      id: eventId,
      type: eventType,
      created_at: iso(at),
      agency_id: me.agency?.id,
      data: { lead_id: leads[0]?.id, client_id: clients[0]!.id, stage: "new" },
    },
    response_body: ok ? "ok" : "Internal Server Error",
    ...extra,
  };
}

{
  const ep = webhookEndpoints[0]!.id;
  webhookDeliveries.push(
    webhookDelivery(ep, "lead.created", true, now() - 9 * min),
    webhookDelivery(ep, "lead.stage_changed", false, now() - 3 * 60 * min),
    webhookDelivery(ep, "lead.created", true, now() - 26 * 60 * min),
  );
}

// Step 5d: two-way CRM sync. The first client has HubSpot connected (with a short log); the others have none.
// Only HubSpot and Pipedrive are "configured" so the unconfigured state shows too.
export const crmProviders: S["CrmProvider"][] = [
  { key: "hubspot", name: "HubSpot", configured: true, amount_supported: false },
  { key: "salesforce", name: "Salesforce", configured: false, amount_supported: false },
  { key: "pipedrive", name: "Pipedrive", configured: true, amount_supported: true },
  { key: "zoho", name: "Zoho CRM", configured: false, amount_supported: false },
];

export const crmStatuses: Record<string, { value: string; label: string }[]> = {
  hubspot: [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "OPEN_DEAL",
    "UNQUALIFIED",
    "ATTEMPTED_TO_CONTACT",
    "CONNECTED",
    "BAD_TIMING",
  ].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase().replaceAll("_", " ") })),
  pipedrive: [
    { value: "stage:1", label: "Sales › Lead in" },
    { value: "stage:2", label: "Sales › Contact made" },
    { value: "stage:3", label: "Sales › Proposal made" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
  ],
};

export function crmConnection(clientId: string, provider: S["CrmProviderKey"]): S["CrmConnectionDetail"] {
  const amount = provider === "pipedrive";
  return {
    id: id(),
    client_id: clientId,
    provider,
    account_id: provider === "hubspot" ? "4242" : "9",
    account_name: provider === "hubspot" ? "dhakadental.hubspot.com" : "Dhaka Dental",
    status: "active",
    health: "healthy",
    consecutive_failures: 0,
    last_error: null,
    last_push_at: iso(now() - 6 * min),
    last_pull_at: iso(now() - 2 * min),
    fields: {
      full_name: { direction: "both", policy: "newest_wins" },
      email: { direction: "both", policy: "newest_wins" },
      phone: { direction: "both", policy: "newest_wins" },
      stage: { direction: "both", policy: "crm_wins" },
      deal_value: { direction: amount ? "both" : "off", policy: "newest_wins" },
    },
    stage_map:
      provider === "hubspot"
        ? {
            new: "NEW",
            contacted: "ATTEMPTED_TO_CONTACT",
            qualified: "CONNECTED",
            won: "OPEN_DEAL",
            lost: "UNQUALIFIED",
          }
        : { new: "stage:1", contacted: "stage:2", qualified: "stage:3", won: "won", lost: "lost" },
    settings: {},
    created_at: iso(now() - 9 * 24 * 60 * min),
    stats: { linked: 0, queued: 0, last_24h: {} },
  };
}

export const crmConnections: S["CrmConnectionDetail"][] = [crmConnection(clients[0]!.id, "hubspot")];
export const crmLogs = new Map<string, S["CrmSyncLogEntry"][]>();
{
  const c = crmConnections[0]!;
  const entry = (
    direction: "push" | "pull",
    result: S["CrmSyncLogEntry"]["result"],
    fields: string[],
    ago: number,
    extra: Partial<S["CrmSyncLogEntry"]> = {},
  ): S["CrmSyncLogEntry"] => ({
    id: id(),
    lead_id: leads[0]?.id ?? null,
    external_id: "5" + Math.round(ago),
    direction,
    result,
    fields,
    conflicts: null,
    error: null,
    at: iso(now() - ago * min),
    ...extra,
  });
  crmLogs.set(c.id, [
    entry("pull", "updated", ["stage"], 2),
    entry("pull", "conflict", [], 40, { conflicts: { full_name: { winner: "crm", policy: "newest_wins" } } }),
    entry("push", "created", ["email", "full_name", "phone", "stage"], 65),
    entry("push", "failed", ["stage"], 180, { error: "HubSpot answered: rate limit reached, retrying" }),
  ]);
  c.stats = { linked: 128, queued: 2, last_24h: { created: 14, updated: 31, conflict: 1, failed: 1 } };
}

// Step 5e: the marketplace. Built-in listings mirror the backend catalog (texts come from translations); two
// partner apps, one already reviewed by other agencies.
const builtInListings: [string, S["MarketplaceCategory"], string, boolean][] = [
  ["meta_lead_ads", "lead_sources", "/integrations/meta", true],
  ["messenger_instagram", "lead_sources", "/integrations/meta", false],
  ["google_ads_lead_forms", "lead_sources", "/integrations", true],
  ["web_forms", "lead_sources", "/integrations", true],
  ["form_tools", "lead_sources", "/integrations", true],
  ["email_in", "lead_sources", "/integrations", false],
  ["meta_conversions", "ads", "/clients", true],
  ["google_ads", "ads", "/integrations", false],
  ["hubspot", "crm", "/integrations", true],
  ["salesforce", "crm", "/integrations", false],
  ["pipedrive", "crm", "/integrations", false],
  ["zoho", "crm", "/integrations", false],
  ["whatsapp", "messaging", "/settings/messaging", true],
  ["sms", "messaging", "/settings/messaging", false],
  ["twilio", "voice", "/settings/calls", false],
  ["cloud_pbx", "voice", "/settings/calls", true],
  ["zapier", "automation", "/settings/developer", false],
  ["make", "automation", "/settings/developer", false],
  ["outgoing_webhooks", "developer", "/settings/developer", true],
  ["public_api", "developer", "/settings/developer", true],
];
const builtInNames: Record<string, string> = {
  meta_lead_ads: "Facebook & Instagram Lead Ads",
  messenger_instagram: "Messenger & Instagram DMs",
  google_ads_lead_forms: "Google Ads lead forms",
  web_forms: "Website forms",
  form_tools: "Typeform, Tally, Jotform, Webflow, Elementor",
  email_in: "Email forwarding",
  meta_conversions: "Meta Conversions API",
  google_ads: "Google Ads conversions & spend",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  pipedrive: "Pipedrive",
  zoho: "Zoho CRM",
  whatsapp: "WhatsApp Business",
  sms: "SMS",
  twilio: "Twilio Voice",
  cloud_pbx: "Cloud PBX",
  zapier: "Zapier",
  make: "Make",
  outgoing_webhooks: "Outgoing webhooks",
  public_api: "Public API",
};

export const marketplaceCategories: S["MarketplaceCategory"][] = [
  "lead_sources",
  "ads",
  "crm",
  "messaging",
  "voice",
  "automation",
  "reporting",
  "developer",
];

export const listings: S["MarketplaceListing"][] = [
  ...builtInListings.map(([key, category, setup, installed]): S["MarketplaceListing"] => ({
    key,
    kind: "built_in",
    name: builtInNames[key]!,
    publisher: "Leadexpa",
    category,
    summary: "",
    description: "",
    setup_path: setup,
    website: null,
    support_email: null,
    scopes: [],
    installed,
    rating: key === "meta_lead_ads" ? 4.8 : key === "hubspot" ? 4.5 : null,
    reviews: key === "meta_lead_ads" ? 23 : key === "hubspot" ? 9 : 0,
    installs: null,
  })),
  {
    key: "leadsheet",
    kind: "partner",
    name: "LeadSheet",
    publisher: "Sheets Co",
    category: "reporting",
    summary: "Every lead in a live Google Sheet, one tab per client.",
    description:
      "Mirrors new leads and stage changes into a spreadsheet the client can open any time. Set it up once per agency; it subscribes to the events it needs by itself.",
    setup_path: null,
    website: "https://example.com/leadsheet",
    support_email: "help@leadsheet.example",
    scopes: ["clients:read", "leads:read", "webhooks:manage"],
    installed: false,
    rating: 4.3,
    reviews: 3,
    installs: 41,
  },
  {
    key: "callpilot",
    kind: "partner",
    name: "CallPilot",
    publisher: "Pilot Labs",
    category: "voice",
    summary: "An AI dialer that works through overdue leads and logs every outcome.",
    description:
      "Calls overdue leads in priority order during business hours and writes each outcome back to the lead.",
    setup_path: null,
    website: "https://example.com/callpilot",
    support_email: null,
    scopes: ["leads:write"],
    installed: false,
    rating: null,
    reviews: 0,
    installs: 7,
  },
];

export const listingReviews = new Map<string, S["MarketplaceReview"][]>([
  [
    "leadsheet",
    [
      {
        rating: 5,
        body: "Our clients love opening the sheet instead of asking us for updates.",
        country: "BD",
        mine: false,
        at: iso(now() - 3 * 24 * 60 * min),
      },
      {
        rating: 4,
        body: "Works well; wish it had a per-campaign tab.",
        country: "AE",
        mine: false,
        at: iso(now() - 9 * 24 * 60 * min),
      },
      { rating: 4, body: "", country: "GB", mine: false, at: iso(now() - 20 * 24 * 60 * min) },
    ],
  ],
  [
    "meta_lead_ads",
    [
      {
        rating: 5,
        body: "Leads show up before the client's phone even buzzes.",
        country: "BD",
        mine: false,
        at: iso(now() - 2 * 24 * 60 * min),
      },
    ],
  ],
]);

export const appInstallations: S["AppInstallation"][] = [];

// Step 6a: payment links. The first client has a bKash sandbox account; its first lead has one paid and one open
// link. Mock tokens are "mock-pay-<link id>" so the pay page works after a reload.
export const paymentAccounts: S["PaymentAccount"][] = [
  {
    id: id(),
    client_id: clients[0]!.id,
    provider: "bkash",
    mode: "sandbox",
    status: "active",
    auto_won: true,
    verified_at: iso(now() - 5 * 24 * 60 * min),
    last_error: null,
    created_at: iso(now() - 5 * 24 * 60 * min),
  },
];

export function paymentLink(leadId: string, clientId: string, extra: Partial<S["PaymentLink"]> = {}): S["PaymentLink"] {
  return {
    id: id(),
    client_id: clientId,
    lead_id: leadId,
    provider: "bkash",
    amount_minor: 500000,
    currency: "BDT",
    purpose: "booking_fee",
    note: "",
    status: "created",
    failed_reason: null,
    expires_at: iso(now() + 72 * 60 * min),
    opened_at: null,
    paid_at: null,
    sale_id: null,
    created_by: me.user.id,
    created_at: iso(now()),
    ...extra,
  };
}

export const paymentLinks: S["PaymentLink"][] = [];
{
  const lead = leads.find((l) => l.client_id === clients[0]!.id);
  if (lead) {
    paymentLinks.push(
      paymentLink(lead.id, lead.client_id, {
        status: "paid",
        amount_minor: 1200000,
        purpose: "advance",
        paid_at: iso(now() - 2 * 24 * 60 * min),
        created_at: iso(now() - 3 * 24 * 60 * min),
        opened_at: iso(now() - 2 * 24 * 60 * min),
      }),
      paymentLink(lead.id, lead.client_id, { created_at: iso(now() - 30 * min) }),
    );
  }
}
