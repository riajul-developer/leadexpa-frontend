import { delay, http, HttpResponse } from "msw";

import { fromStarter, overlaps as rbOverlaps, problem as rbProblem } from "@/features/reportbuilder/grid";
import type { components } from "@/shared/lib/api/schema";

import * as db from "./db";

type S = components["schemas"];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const url = (p: string) => `${API}${p}`;

function problem(status: number, code: string, detail: string) {
  return HttpResponse.json(
    { type: `https://docs.recov.app/problems/${code}`, title: code, status, code, detail },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

// Mock action tokens are "mock-<lead id>"; "mock-expired" always reads as expired.

function actionLinkView(token: string) {
  if (token === "mock-expired") return problem(400, "action_link_expired", "This link has expired.");
  const l = token.startsWith("mock-") ? findLead(token.slice(5)) : undefined;
  if (!l?.owner_user_id) return problem(400, "action_link_invalid", "This link is no longer valid.");
  const view: S["ActionLinkView"] = {
    lead_id: l.id,
    full_name: l.full_name,
    phone: l.phone,
    client_name: db.clients.find((c) => c.id === l.client_id)?.name ?? "",
    stage: l.stage,
    received_at: l.received_at,
    answers: l.custom_fields ?? {},
    sla: l.sla,
    do_not_contact: l.do_not_contact,
    expires_at: db.iso(db.now() + 72 * 3600_000),
  };
  return view;
}

const list = <T>(data: T[]) => ({ data, next_cursor: null });

// Pay tokens carry their link: the payer's page is a fresh load without mock data.
function mockPayToken(l: S["PaymentLink"]) {
  const raw = JSON.stringify(l);
  return (
    "mock-pay-" +
    btoa(String.fromCharCode(...new TextEncoder().encode(raw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}

function mockPayLink(token: string): S["PaymentLink"] | undefined {
  const seeded = db.paymentLinks.find((x) => `mock-pay-${x.id}` === token);
  let l = seeded;
  if (!l && token.startsWith("mock-pay-")) {
    try {
      const b64 = token.slice(9).replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      l = JSON.parse(new TextDecoder().decode(bytes)) as S["PaymentLink"];
      db.paymentLinks.push(l);
    } catch {
      return undefined;
    }
  }
  const paidAt = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(`mock-paid:${token}`);
  if (l && paidAt) Object.assign(l, { status: "paid", paid_at: paidAt });
  return l;
}

// sessionStorage: survives the Stripe checkout redirect (a fresh load).
type MockBilling = { subscription: S["Subscription"] | null; budgets: Record<string, number> };
const MOCK_PRICES: Record<string, number> = { starter: 149000, growth: 299000, pro: 499000 };
function mockBilling(): MockBilling {
  const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("mock-billing");
  return raw ? (JSON.parse(raw) as MockBilling) : { subscription: null, budgets: { whatsapp_messages: 2000 } };
}
function saveBilling(b: MockBilling) {
  sessionStorage.setItem("mock-billing", JSON.stringify(b));
}
function mockSubscription(plan: string, interval: "month" | "year"): S["Subscription"] {
  const amount = (MOCK_PRICES[plan] ?? 0) * (interval === "year" ? 10 : 1);
  return {
    status: "active",
    plan,
    interval,
    currency: db.agency.default_currency,
    amount_minor: amount,
    current_period_end: db.iso(db.now() + (interval === "year" ? 365 : 30) * 864e5),
    cancel_at_period_end: false,
    past_due_since: null,
    grace_until: null,
  };
}
function mockUsage(b: MockBilling): S["UsageReport"] {
  const d = new Date(db.now());
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const used: Record<string, number> = {
    whatsapp_messages: 1730,
    sms_messages: 214,
    ai_generations: 42,
    call_minutes: 386,
  };
  return {
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    meters: (["whatsapp_messages", "sms_messages", "ai_generations", "call_minutes"] as const).map((meter) => {
      const budget = b.budgets[meter] ?? null;
      return { meter, used: used[meter]!, budget, percent: budget ? Math.floor((used[meter]! * 100) / budget) : null };
    }),
  };
}

// sessionStorage: Stripe onboarding and checkout are full-page trips.
type MockResale = {
  account: S["ConnectedAccount"];
  plans: S["ResellerPlan"][];
  links: (S["ResellerLink"] & { code: string })[];
  customers: S["ResellerOverview"]["customers"];
  sales: S["ResellerOverview"]["sales"];
  partner: { enrolled: boolean; code: string; clicks: number };
};
function mockResale(): MockResale {
  const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("mock-resale");
  if (raw) return JSON.parse(raw) as MockResale;
  return {
    account: {
      connected: false,
      status: "none",
      account_id: null,
      country: null,
      default_currency: null,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      requirements_due: 0,
      fee_percent: 0,
      available: true,
    },
    plans: [],
    links: [],
    customers: [],
    sales: [],
    partner: { enrolled: false, code: "lx7k2m9q", clicks: 0 },
  };
}
function saveResale(r: MockResale) {
  sessionStorage.setItem("mock-resale", JSON.stringify(r));
}
function resaleOverview(r: MockResale): S["ResellerOverview"] {
  const by = new Map<string, S["ResellerOverview"]["earnings"][number]>();
  for (const x of r.sales) {
    const e = by.get(x.currency) ?? {
      currency: x.currency,
      gross_minor: 0,
      fees_minor: 0,
      refunds_minor: 0,
      disputes_minor: 0,
      net_minor: 0,
    };
    if (x.kind === "payment") e.gross_minor += x.amount_minor;
    if (x.kind === "refund") e.refunds_minor += x.amount_minor;
    if (x.kind === "dispute") e.disputes_minor += x.amount_minor;
    e.net_minor = e.gross_minor - e.fees_minor - e.refunds_minor - e.disputes_minor;
    by.set(x.currency, e);
  }
  return { earnings: [...by.values()], customers: r.customers, sales: r.sales };
}
function mockPartnerProgram(r: MockResale): S["PartnerProgram"] {
  const cur = db.agency.default_currency;
  const p = r.partner;
  return {
    enrolled: p.enrolled,
    code: p.enrolled ? p.code : null,
    link: p.enrolled ? `${location.origin}/en/signup?ref=${p.code}` : null,
    status: p.enrolled ? "active" : null,
    commission_percent: 20,
    months: 12,
    hold_days: 30,
    clicks: p.enrolled ? p.clicks + 37 : 0,
    signups: p.enrolled ? 3 : 0,
    active_referrals: p.enrolled ? 2 : 0,
    balances: p.enrolled ? [{ currency: cur, pending_minor: 119600, available_minor: 59800, paid_minor: 239200 }] : [],
    payout_account: r.account,
  };
}

const mockSkills = new Map<string, S["MemberSkills"]>();
const mockScoring: S["ScoringModel"] = {
  source: "rules",
  version: "rules-v1",
  status: "active",
  trained_at: null,
  checked_at: null,
  metrics: null,
  labeled: 1240,
  min_labels: 3000,
  pool_opt_in: false,
  weights: [
    { feature: "campaign_rate", weight: 2 },
    { feature: "responded", weight: 1.3 },
    { feature: "age_days", weight: -1.2 },
    { feature: "repeat_customer", weight: 0.9 },
    { feature: "quality", weight: 0.9 },
    { feature: "src_manual", weight: 0.8 },
    { feature: "callback_planned", weight: 0.8 },
    { feature: "fast_response", weight: 0.6 },
    { feature: "slow_response", weight: -0.5 },
    { feature: "verified", weight: 0.5 },
    { feature: "attempts", weight: -0.4 },
  ],
  feedback_too_high: 3,
  feedback_too_low: 5,
};

function mockHealth(clientId: string): S["ClientHealth"] {
  const i = db.clients.findIndex((c) => c.id === clientId);
  const score = [82, 54, 33][i] ?? 70;
  const band = score >= 70 ? "healthy" : score >= 40 ? "watch" : "at_risk";
  const day = (back: number) => db.iso(db.now() - back * 864e5).slice(0, 10);
  const anomalies: S["ClientAnomaly"][] =
    i === 1
      ? [
          {
            metric: "leads",
            day: day(2),
            actual: 3,
            expected: 21.4,
            z: -3.98,
            direction: "down",
            adverse: true,
            hint: {
              campaign_id: db.newId(),
              campaign: "Eid offer",
              leads_day: 0,
              leads_avg: 14.2,
              spend_stopped: true,
            },
          },
          {
            metric: "cpl",
            day: day(9),
            actual: 310,
            expected: 480,
            z: -3.2,
            direction: "down",
            adverse: false,
            hint: {},
          },
        ]
      : i === 2
        ? [
            {
              metric: "sla_compliance",
              day: day(1),
              actual: 0.42,
              expected: 0.88,
              z: -4.6,
              direction: "down",
              adverse: true,
              hint: {},
            },
          ]
        : [];
  return {
    client_id: clientId,
    score,
    band,
    computed_at: db.iso(db.now() - 3 * 3600_000),
    components: [
      { key: "volume", score: Math.min(100, score + 10), weight: 0.25, value: (score + 10) / 100, baseline: 21 },
      {
        key: "speed",
        score: Math.max(20, score - 5),
        weight: 0.2,
        value: Math.max(0.2, (score - 5) / 100),
        baseline: null,
      },
      { key: "contact", score: Math.min(100, score + 4), weight: 0.15, value: 0.84, baseline: 0.88 },
      { key: "conversion", score, weight: 0.2, value: 0.22, baseline: 0.27 },
      { key: "cost", score: 90, weight: 0.1, value: 41000, baseline: 37000 },
      {
        key: "stability",
        score: 100 - 20 * anomalies.filter((a) => a.adverse).length,
        weight: 0.1,
        value: anomalies.filter((a) => a.adverse).length,
        baseline: null,
      },
    ],
    trend: Array.from({ length: 30 }, (_, k) => ({
      day: day(29 - k),
      score: Math.max(5, Math.min(99, score + Math.round(Math.sin(k / 4) * 6) + (29 - k) / 3)),
    })),
    anomalies,
  };
}

const mockAgents = new Map<string, S["Agent"]>();
function mockAgent(clientId: string): S["Agent"] {
  let a = mockAgents.get(clientId);
  if (!a) {
    const first = db.clients[0]?.id === clientId;
    a = {
      client_id: clientId,
      autonomy: first ? 1 : 0,
      channels: ["whatsapp", "messenger"],
      languages: ["en", "bn"],
      goals: "Answer questions and book a consultation.",
      policy: "Only talk about the clinic's services, hours and location. Never discuss prices.",
      qualification: [
        { key: "service", question: "Which treatment are you interested in?" },
        { key: "timeline", question: "When would you like to come in?" },
      ],
      handoff_triggers: ["buying_intent", "complaint", "price_negotiation", "human_requested", "low_confidence"],
      min_confidence: 0.6,
      max_turns: 12,
      max_cost_micros: 200000,
      daily_cost_micros: 5000000,
      hours_start: 9,
      hours_end: 18,
      opted_in_at: null,
      killed: mockKill.killed,
      evals: first
        ? [{ language: "en", passed: true, score: 1, ran_at: db.iso(db.now() - 3 * 864e5), valid: true }]
        : [],
    };
    mockAgents.set(clientId, a);
  }
  return { ...a, killed: mockKill.killed };
}
const mockKill = { killed: false };
const mockKb = new Map<string, S["KbDocument"][]>();
const mockKbFor = (clientId: string) => {
  if (!mockKb.has(clientId))
    mockKb.set(clientId, [
      {
        id: db.newId(),
        title: "Opening hours & location",
        source_url: null,
        chars: 420,
        chunks: 1,
        created_at: db.iso(db.now() - 5 * 864e5),
      },
      {
        id: db.newId(),
        title: "Treatments",
        source_url: "https://clinic.example/treatments",
        chars: 2310,
        chunks: 4,
        created_at: db.iso(db.now() - 4 * 864e5),
      },
    ]);
  return mockKb.get(clientId)!;
};
let mockDrafts: S["AgentDraft"][] | null = null;
function drafts(): S["AgentDraft"][] {
  if (!mockDrafts) {
    const c = db.clients[0]!;
    mockDrafts = db.leads
      .filter((l) => l.client_id === c.id)
      .slice(0, 2)
      .map((l, i) => ({
        id: db.newId(),
        client_id: c.id,
        client_name: c.name,
        conversation_id: db.newId(),
        lead_id: l.id,
        lead_name: l.full_name,
        last_inbound: i === 0 ? "Are you open on Friday?" : "Do you have parking?",
        reply:
          i === 0
            ? "We're closed on Fridays. We're open Saturday to Thursday, 10am to 8pm."
            : "Yes, there's free parking in front of the building.",
        citations: [db.newId()],
        created_at: db.iso(db.now() - (i + 1) * 4 * 60_000),
      }));
  }
  return mockDrafts;
}
let mockConvs: S["AgentConversation"][] | null = null;
function convs(): S["AgentConversation"][] {
  if (!mockConvs) {
    const c = db.clients[0]!;
    const leads = db.leads.filter((l) => l.client_id === c.id).slice(2, 6);
    const base = (i: number, l: (typeof leads)[number]): S["AgentConversation"] => ({
      conversation_id: db.newId(),
      client_id: c.id,
      client_name: c.name,
      lead_id: l.id,
      lead_name: l.full_name,
      status: "active",
      language: "en",
      turns: 3,
      cost_micros: 41000,
      collected: {},
      summary: "",
      handoff_reason: null,
      handed_off_at: null,
      quality: null,
      needs_review: false,
      last_turn_at: db.iso(db.now() - (i + 1) * 9 * 60_000),
    });
    mockConvs = leads.map((l, i) => {
      const x = base(i, l);
      if (i === 1)
        Object.assign(x, {
          status: "handed_off",
          handoff_reason: "human_requested",
          handed_off_at: x.last_turn_at,
          language: "bn",
          summary: "Asked about implants, budget around 50,000, wants to talk to a dentist.",
          collected: { service: "implants" },
          needs_review: true,
        });
      if (i === 2)
        Object.assign(x, {
          status: "handed_off",
          handoff_reason: "blocked:unsupported_price",
          handed_off_at: x.last_turn_at,
          summary: "Asked for a package price.",
        });
      if (i === 3) Object.assign(x, { status: "ended", quality: 4 });
      if (i === 0)
        Object.assign(x, {
          summary: "Asked about opening hours; next: which treatment.",
          collected: { service: "whitening" },
        });
      return x;
    });
  }
  return mockConvs;
}

function findLead(id: string) {
  return db.leads.find((l) => l.id === id);
}

function stripDetail(l: S["LeadDetail"]): S["Lead"] {
  const { submissions: _s, touchpoints: _t, ...lead } = l;
  return lead;
}

function filterLeads(u: URL) {
  const q = (u.searchParams.get("q") ?? "").toLowerCase().replace(/[\s-]/g, "");
  const stages = u.searchParams.get("stage")?.split(",");
  const owner = u.searchParams.get("owner");
  const client = u.searchParams.get("client_id");
  const from = u.searchParams.get("received_from");
  const to = u.searchParams.get("received_to");
  const quality = u.searchParams.get("quality") ?? (q ? "all" : "");
  const campaign = u.searchParams.get("campaign_id");
  const overdue = u.searchParams.get("sla") === "overdue";
  return db.leads
    .filter((l) => (quality === "all" ? true : quality ? l.quality.status === quality : l.quality.status !== "junk"))
    .filter((l) => !client || l.client_id === client)
    .filter((l) => !campaign || l.campaign?.id === campaign)
    .filter((l) => !overdue || l.sla?.status === "overdue")
    .filter((l) => !stages || stages.includes(l.stage))
    .filter((l) => !owner || (owner === "unassigned" ? !l.owner_user_id : l.owner_user_id === owner))
    .filter((l) => !from || l.received_at >= from)
    .filter((l) => !to || l.received_at <= to)
    .filter(
      (l) =>
        !q ||
        l.full_name.toLowerCase().includes(q) ||
        (l.phone?.display.replace("-", "") ?? "").includes(q) ||
        (l.phone?.e164 ?? "").includes(q.replace(/^0/, "")),
    )
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
}

function consentView(leadId: string): S["ConsentView"] {
  const lead = db.leads.find((x) => x.id === leadId);
  const consent = (lead?.consent ?? {}) as { whatsapp_opt_in?: boolean; consent_text?: string };
  const history: S["ConsentEvent"][] = [];
  const state: S["ConsentView"]["state"] = {};
  if (consent.whatsapp_opt_in != null) {
    state.whatsapp = {
      contact: consent.whatsapp_opt_in,
      marketing: null,
      written: !!consent.consent_text,
      opted_out: false,
    };
    history.push({
      id: "00000000-0000-0000-0000-000000000000",
      channel: "whatsapp",
      scope: "contact",
      granted: consent.whatsapp_opt_in,
      source: "form",
      written: !!consent.consent_text,
      evidence: { consent_text: consent.consent_text ?? "" },
      actor_user_id: null,
      captured_at: lead!.received_at,
    });
  }
  for (const e of db.consentEvents.get(leadId) ?? []) {
    const s = state[e.channel] ?? { contact: null, marketing: null, written: false, opted_out: false };
    if (e.scope === "contact") {
      s.contact = e.granted;
      s.opted_out = !e.granted;
    } else s.marketing = e.granted;
    state[e.channel] = s;
    history.push(e);
  }
  if (lead?.do_not_contact && !state.any)
    state.any = { contact: false, marketing: null, written: false, opted_out: true };
  return { state, history };
}

function paginate<T>(rows: T[], u: URL) {
  const limit = Number(u.searchParams.get("limit") ?? 50);
  const offset = Number(u.searchParams.get("cursor") ?? 0);
  const page = rows.slice(offset, offset + limit);
  return { data: page, next_cursor: offset + limit < rows.length ? String(offset + limit) : null };
}

function ratio(n: number, d: number) {
  return d === 0 ? null : n / d;
}

function dashboard(u: URL): S["Dashboard"] {
  const client = u.searchParams.get("client_id");
  const from = u.searchParams.get("from")!;
  const to = u.searchParams.get("to")!;
  const inRangeAll = db.leads.filter(
    (l) =>
      (!client || l.client_id === client) && l.received_at.slice(0, 10) >= from && l.received_at.slice(0, 10) <= to,
  );
  const inRange = inRangeAll.filter((l) => l.quality.status !== "junk");
  const junkOf = (rows: typeof inRangeAll) => rows.filter((l) => l.quality.status === "junk").length;
  const won = inRange.filter((l) => l.stage === "won");
  const lost = inRange.filter((l) => l.stage === "lost");
  const contacted = inRange.filter((l) => l.first_response_at);
  const revenue = won.reduce((s, l) => s + (l.deal_value?.amount_minor ?? 0), 0);
  const speeds = contacted
    .map((l) => (Date.parse(l.first_response_at!) - Date.parse(l.received_at)) / 1000)
    .sort((a, b) => a - b);
  const kpis: S["KPIs"] = {
    leads_received: inRange.length,
    leads_junk: junkOf(inRangeAll),
    junk_rate: ratio(junkOf(inRangeAll), inRangeAll.length),
    contact_rate: ratio(contacted.length, inRange.length),
    qualified_rate: ratio(inRange.filter((l) => l.qualified_at).length, inRange.length),
    win_rate: ratio(won.length, won.length + lost.length),
    leads_won: won.length,
    sla_compliance: ratio(
      contacted.filter((l) => Date.parse(l.first_response_at!) - Date.parse(l.received_at) <= 15 * 60_000).length,
      contacted.length,
    ),
    sla_breached: inRange.filter((l) => l.sla?.status === "overdue").length,
    speed_to_lead: {
      median_seconds: speeds[Math.floor(speeds.length / 2)] ?? null,
      p90_seconds: speeds[Math.floor(speeds.length * 0.9)] ?? null,
      leads: speeds.length,
    },
    overdue_now: db.leads.filter((l) => l.sla?.status === "overdue").length,
    revenue: revenue ? [{ amount_minor: revenue, currency: "BDT" }] : [],
    spend: [{ amount_minor: 4_500_000, currency: "BDT" }],
    cpl: inRange.length ? { amount_minor: Math.round(4_500_000 / inRange.length), currency: "BDT" } : null,
    converted: null,
    cost_per_sale: won.length ? { amount_minor: Math.round(4_500_000 / won.length), currency: "BDT" } : null,
    roas: revenue / 4_500_000,
    coverage: ratio(won.filter((l) => db.sales.has(l.id)).length, won.length),
  };
  const row = (rows: typeof inRangeAll, idv: string | null, name: string): S["Breakdown"] => ({
    id: idv,
    name,
    leads_received: rows.filter((l) => l.quality.status !== "junk").length,
    leads_junk: junkOf(rows),
    junk_rate: ratio(junkOf(rows), rows.length),
    contact_rate: ratio(rows.filter((l) => l.first_response_at).length, rows.length),
    leads_won: rows.filter((l) => l.stage === "won").length,
    win_rate: ratio(
      rows.filter((l) => l.stage === "won").length,
      rows.filter((l) => l.stage === "won" || l.stage === "lost").length,
    ),
    sla_compliance: ratio(rows.filter((l) => l.first_response_at).length, rows.length),
    sla_breached: rows.filter((l) => l.sla?.status === "overdue").length,
    revenue_minor: rows.reduce((s, l) => s + (l.stage === "won" ? (l.deal_value?.amount_minor ?? 0) : 0), 0),
    spend_minor: 0,
    currency: "BDT",
  });
  const days: S["Breakdown"][] = [];
  for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    days.push({
      ...row(
        inRangeAll.filter((l) => l.received_at.startsWith(day)),
        null,
        "",
      ),
      day,
    });
  }
  const group = <K>(key: (l: (typeof inRangeAll)[number]) => K) => [...new Set(inRangeAll.map(key))];
  return {
    period: { from, to, timezone: "Asia/Dhaka" },
    previous_period: { from, to, timezone: "Asia/Dhaka" },
    kpis,
    previous_kpis: { ...kpis, leads_received: Math.round(kpis.leads_received * 0.8) },
    by_day: days,
    by_campaign: group((l) => l.campaign?.id ?? null).map((cid) =>
      row(
        inRangeAll.filter((l) => (l.campaign?.id ?? null) === cid),
        cid,
        inRangeAll.find((l) => l.campaign?.id === cid)?.campaign?.name ?? "",
      ),
    ),
    by_agent: group((l) => l.owner_user_id).map((uid) =>
      row(
        inRangeAll.filter((l) => l.owner_user_id === uid),
        uid,
        db.members.find((m) => m.user.id === uid)?.user.name ?? "",
      ),
    ),
    by_client: db.clients.map((c) =>
      row(
        inRangeAll.filter((l) => l.client_id === c.id),
        c.id,
        c.name,
      ),
    ),
    computed_at: new Date().toISOString(),
    definition_version: "2026-10-m3",
    definitions: {
      leads_received: { basis: "cohort", formula: "Leads whose received_at falls in the period (client timezone)." },
      speed_to_lead: { basis: "cohort", formula: "Median and p90 of first-response time in business hours." },
      sla_compliance: { basis: "cohort", formula: "First-response timers met ÷ (met + breached)." },
      overdue_now: { basis: "live", formula: "Open leads whose SLA is breached right now." },
      revenue: { basis: "activity", formula: "Sum of non-voided sales with sold_at in the period." },
    },
  };
}

function progress(c: S["Call"]): S["Call"] {
  if (c.status !== "ringing") return c;
  const started = Date.parse(c.started_at);
  if (Date.now() - started < 3000) return c;
  const at = db.iso(db.now());
  const activity: S["Activity"] = {
    id: db.newId(),
    lead_id: c.lead_id,
    actor_user_id: c.agent_user_id,
    type: "call",
    channel: "phone",
    direction: "outbound",
    outcome: "connected",
    body: "",
    meta: { call_id: c.id, duration_seconds: 42, via: "telephony" },
    counts_as_attempt: true,
    counts_as_response: true,
    occurred_at: at,
    created_at: at,
  };
  db.activities.set(c.lead_id, [...(db.activities.get(c.lead_id) ?? []), activity]);
  const l = findLead(c.lead_id);
  if (l) {
    Object.assign(l, {
      last_activity_at: at,
      first_attempt_at: l.first_attempt_at ?? at,
      first_response_at: l.first_response_at ?? at,
      stage: l.stage === "new" ? "contacted" : l.stage,
    });
  }
  return Object.assign(c, {
    status: "completed",
    answered_at: db.iso(started + 3000),
    ended_at: at,
    duration_seconds: 42,
    activity_id: activity.id,
  });
}

// "mfa@…" needs a second step; "+gate" makes the agency require 2FA.
const MFA_TOKEN = "mock-mfa-token";

// The demo owner is never blocked; "+offsite" sign-ins see the blocked gate.
const mockAccess: { blocked: boolean; policy: S["AccessPolicy"] } = {
  blocked: false,
  policy: { ip_allowlist: [], session_max_hours: null, session_idle_minutes: null, your_ip: "198.51.100.23" },
};

function currentMe(): S["Me"] {
  const user = { ...db.me.user, login_alerts: db.security.login_alerts, mfa_enabled: mfaEnabled() };
  if (mockAccess.blocked) {
    return {
      ...db.me,
      user,
      agency: null,
      membership: null,
      permissions: [],
      mfa_required: null,
      access_blocked: { agency_id: db.agency.id, agency_name: db.agency.name, ip: mockAccess.policy.your_ip },
    };
  }
  if (db.agency.require_admin_mfa && !db.security.session_verified) {
    return {
      ...db.me,
      user,
      agency: null,
      membership: null,
      permissions: [],
      mfa_required: { agency_id: db.agency.id, agency_name: db.agency.name, enrolled: mfaEnabled() },
    };
  }
  return withSandbox({ ...db.me, user, agency: db.agency, mfa_required: null, access_blocked: null });
}

function mfaEnabled() {
  return db.security.totp_enabled || db.security.passkeys.length > 0;
}

function securityEvent(kind: S["SecurityEvent"]["kind"]) {
  db.security.recent_events.unshift({
    id: db.newId(),
    kind,
    ip: "103.4.145.2",
    country: "BD",
    device: { browser: "Chrome", os: "Windows" },
    detail: {},
    created_at: db.iso(db.now()),
  });
}

function verified() {
  db.security.session_verified = true;
  db.sessions[0]!.mfa = true;
}

const securityHandlers = [
  http.get(url("/v1/me/security"), () => HttpResponse.json(db.security)),
  http.post(url("/v1/me/security/verify"), async ({ request }) => {
    const b = (await request.json()) as { method: string; code?: string };
    if (b.method === "passkey" || b.code?.replace(/\s/g, "") === "123456" || db.recoveryCodes.includes(b.code ?? "")) {
      verified();
      return new HttpResponse(null, { status: 204 });
    }
    return problem(401, "mfa_invalid", "That code or passkey didn't work. Try again.");
  }),
  http.post(url("/v1/me/security/totp/setup"), () =>
    HttpResponse.json({
      secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
      otpauth_uri: "otpauth://totp/Recov:owner%40demo.recov.local?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Recov",
    }),
  ),
  http.post(url("/v1/me/security/totp/confirm"), async ({ request }) => {
    const b = (await request.json()) as { code: string };
    if (b.code !== "123456") return problem(400, "mfa_invalid", "That code isn't right.");
    const first = !mfaEnabled();
    db.security.totp_enabled = true;
    verified();
    securityEvent("totp_enabled");
    if (first) db.security.recovery_codes_remaining = db.recoveryCodes.length;
    return HttpResponse.json({ recovery_codes: first ? db.recoveryCodes : [] });
  }),
  http.delete(url("/v1/me/security/totp"), () => {
    if (!db.security.session_verified) return problem(403, "step_up_required", "Confirm it's you first.");
    db.security.totp_enabled = false;
    if (!mfaEnabled()) db.security.recovery_codes_remaining = 0;
    securityEvent("totp_disabled");
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/me/security/recovery-codes"), () => {
    db.security.recovery_codes_remaining = db.recoveryCodes.length;
    securityEvent("recovery_codes_generated");
    return HttpResponse.json({ recovery_codes: db.recoveryCodes });
  }),
  http.post(url("/v1/me/security/passkeys/options"), () =>
    HttpResponse.json({ challenge_id: db.newId(), options: { publicKey: { challenge: "bW9jaw" } } }),
  ),
  http.patch(url("/v1/me/security/passkeys/:id"), async ({ params, request }) => {
    const pk = db.security.passkeys.find((p) => p.id === params.id);
    if (!pk) return problem(404, "not_found", "Passkey not found.");
    pk.name = ((await request.json()) as { name: string }).name;
    return HttpResponse.json(pk);
  }),
  http.delete(url("/v1/me/security/passkeys/:id"), ({ params }) => {
    db.security.passkeys = db.security.passkeys.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/me/sessions"), () => HttpResponse.json(list(db.sessions))),
  http.delete(url("/v1/me/sessions/:id"), ({ params }) => {
    const i = db.sessions.findIndex((s) => s.id === params.id);
    if (i < 0) return problem(404, "not_found", "Session not found.");
    db.sessions.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/me/sessions/revoke-others"), () => {
    const n = db.sessions.length - 1;
    db.sessions.splice(1);
    return HttpResponse.json({ revoked: n });
  }),
  http.post(url("/v1/auth/mfa/verify"), async ({ request }) => {
    const b = (await request.json()) as { code?: string };
    if (b.code?.replace(/\s/g, "") === "123456" || db.recoveryCodes.includes(b.code ?? "")) {
      verified();
      return HttpResponse.json(currentMe());
    }
    return problem(401, "mfa_invalid", "That code or passkey didn't work. Try again.");
  }),
  http.post(url("/v1/auth/passkey/options"), () =>
    HttpResponse.json({ challenge_id: db.newId(), options: { publicKey: { challenge: "bW9jaw" } } }),
  ),
];

// Tokens: "mock-book-<lead id>" and "mock-appt-<appointment id>".
const mockBookings = new Map<string, S["Booking"]>();
function mockBooking(clientId: string): S["Booking"] {
  let b = mockBookings.get(clientId);
  if (!b) {
    const first = db.clients[0]?.id === clientId;
    const day = [{ from: "10:00", to: "18:00" }];
    b = {
      client_id: clientId,
      enabled: true,
      title: "Consultation",
      duration_minutes: 30,
      buffer_minutes: 10,
      min_notice_minutes: 120,
      horizon_days: 14,
      max_per_day: null,
      assignment: "owner_first",
      hours: { sat: day, sun: day, mon: day, tue: day, wed: day, thu: day },
      location: first ? "House 12, Road 7, Gulshan 2, Dhaka" : "",
      self_booking: true,
      reminder_minutes: [1440, 120],
      confirm_high_risk: true,
      reminder_template: null,
      reminder_template_language: null,
      hosts: db.members.slice(0, 2).map((m) => m.user.id),
      resources: [],
      timezone: db.clients.find((c) => c.id === clientId)?.timezone ?? "Asia/Dhaka",
    };
    mockBookings.set(clientId, b);
  }
  return b;
}

let mockCalendar: S["CalendarStatus"] = {
  connected: false,
  provider: null,
  email: null,
  status: null,
  error: null,
  available: ["google", "microsoft"],
};

function loadAppts(): S["Appointment"][] {
  try {
    const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("mock-appointments");
    if (raw) return JSON.parse(raw) as S["Appointment"][];
  } catch {
    // private mode: start from the seed
  }
  const out: S["Appointment"][] = [];
  const at = (days: number, hour: number) => {
    const d = new Date(db.now() + days * 864e5);
    d.setUTCHours(hour - 6, 0, 0, 0); // Dhaka is UTC+6
    return d.getTime();
  };
  db.leads.slice(0, 5).forEach((l, i) => {
    const start = at([-1, 0, 1, 2, 4][i]!, [11, 16, 12, 15, 10][i]!);
    const past = start < db.now();
    out.push({
      id: `appt-${l.id}`,
      client_id: l.client_id,
      client_name: db.clients.find((c) => c.id === l.client_id)?.name ?? "",
      lead_id: l.id,
      lead_name: l.full_name,
      host_user_id: l.owner_user_id ?? db.members[0]!.user.id,
      resource_id: null,
      title: "Consultation",
      location: "House 12, Road 7, Gulshan 2, Dhaka",
      starts_at: db.iso(start),
      ends_at: db.iso(start + 30 * 60_000),
      status: past ? "booked" : i === 2 ? "confirmed" : "booked",
      source: (["agent", "self", "ai", "agent", "self"] as const)[i]!,
      notes: "",
      risk_score: i === 4 ? 72 : 25,
      risk_factors: i === 4 ? ["booked_days_ahead", "never_replied", "ad_lead"] : [],
      language: i % 2 ? "bn" : "en",
      on_calendar: i < 3,
      created_at: db.iso(start - 2 * 864e5),
    });
  });
  return out;
}
let mockAppts: S["Appointment"][] | null = null;
const appts = () => (mockAppts ??= loadAppts());
function saveAppts() {
  try {
    sessionStorage.setItem("mock-appointments", JSON.stringify(appts()));
  } catch {
    // not persisted: fine for a demo
  }
}

function mockSlots(clientId: string, exclude?: string): S["Slot"][] {
  const b = mockBooking(clientId);
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const taken = appts().filter(
    (a) => a.client_id === clientId && a.id !== exclude && (a.status === "booked" || a.status === "confirmed"),
  );
  const out: S["Slot"][] = [];
  const earliest = db.now() + b.min_notice_minutes * 60_000;
  for (let d = 0; d < b.horizon_days && out.length < 60; d++) {
    const local = new Date(db.now() + 6 * 3600_000 + d * 864e5); // Dhaka wall clock
    for (const w of b.hours[keys[local.getUTCDay()]!] ?? []) {
      const [fh, fm] = w.from.split(":").map(Number);
      const [th, tm] = w.to.split(":").map(Number);
      const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 6 * 3600_000;
      for (let m = fh! * 60 + fm!; m + b.duration_minutes <= th! * 60 + tm!; m += b.duration_minutes) {
        const s = base + m * 60_000;
        const e = s + b.duration_minutes * 60_000;
        if (s < earliest) continue;
        const pad = b.buffer_minutes * 60_000;
        if (taken.some((a) => Date.parse(a.starts_at) < e + pad && Date.parse(a.ends_at) > s - pad)) continue;
        out.push({ start: db.iso(s), end: db.iso(e) });
      }
    }
  }
  return out.slice(0, 60);
}

function mockBook(
  leadId: string,
  start: string,
  source: S["Appointment"]["source"],
  language = "en",
  replaces?: string,
) {
  const l = findLead(leadId);
  if (!l) return problem(404, "not_found", "Lead not found.");
  const b = mockBooking(l.client_id);
  if (!b.enabled) return problem(409, "booking_disabled", "Booking isn't turned on for this client.");
  if (!mockSlots(l.client_id, replaces).some((s) => s.start === start))
    return problem(409, "booking_slot_taken", "That time is no longer available. Pick another.");
  if (replaces) {
    const old = appts().find((a) => a.id === replaces);
    if (old) old.status = "cancelled";
  }
  const s = Date.parse(start);
  const a: S["Appointment"] = {
    id: db.newId(),
    client_id: l.client_id,
    client_name: db.clients.find((c) => c.id === l.client_id)?.name ?? "",
    lead_id: l.id,
    lead_name: l.full_name,
    host_user_id: l.owner_user_id ?? b.hosts[0] ?? db.members[0]!.user.id,
    resource_id: null,
    title: b.title,
    location: b.location,
    starts_at: db.iso(s),
    ends_at: db.iso(s + b.duration_minutes * 60_000),
    status: "booked",
    source,
    notes: "",
    risk_score: s - db.now() > 7 * 864e5 ? 65 : 30,
    risk_factors: s - db.now() > 7 * 864e5 ? ["booked_far_ahead", "never_replied"] : [],
    language,
    on_calendar: mockCalendar.connected,
    created_at: db.iso(db.now()),
  };
  appts().push(a);
  saveAppts();
  return a;
}

function publicView(a: S["Appointment"], token?: string): S["PublicAppointment"] {
  const b = mockBooking(a.client_id);
  const open = (a.status === "booked" || a.status === "confirmed") && Date.parse(a.starts_at) > db.now();
  return {
    client: a.client_name ?? "",
    title: a.title,
    location: a.location,
    timezone: b.timezone,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    can_change: open,
    can_reschedule: open && b.enabled && b.self_booking,
    ...(token ? { token } : {}),
  };
}

const apptByToken = (token: string) =>
  token.startsWith("mock-appt-") ? appts().find((a) => a.id === token.slice(10)) : undefined;

function funnel(clientId?: string): S["AppointmentFunnel"] {
  const leads = db.leads.filter((l) => !clientId || l.client_id === clientId);
  const groups = new Map<string, typeof leads>();
  for (const l of leads) {
    const k = l.campaign?.name ?? "";
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const ratio = (a: number, b: number) => (b ? a / b : null);
  const row = (name: string, ls: typeof leads): S["AppointmentFunnelRow"] => {
    const of = (l: (typeof leads)[number]) => appts().filter((a) => a.lead_id === l.id);
    const booked = ls.filter((l) => of(l).length > 0).length;
    const attended = ls.filter((l) => of(l).some((a) => a.status === "attended")).length;
    const noShow = ls.filter(
      (l) => of(l).some((a) => a.status === "no_show") && !of(l).some((a) => a.status === "attended"),
    ).length;
    const leadsN = ls.length * 6;
    const bookedN = booked + Math.round(leadsN * 0.32);
    const attendedN = attended + Math.round(bookedN * 0.7);
    const noShowN = noShow + Math.round(bookedN * 0.18);
    return {
      campaign_id: ls[0]?.campaign?.id ?? null,
      campaign: name,
      leads: leadsN,
      booked: bookedN,
      attended: attendedN,
      no_show: noShowN,
      won: Math.round(attendedN * 0.45),
      show_rate: ratio(attendedN, attendedN + noShowN),
      book_rate: ratio(bookedN, leadsN),
    };
  };
  const rows = [...groups.entries()].map(([k, ls]) => row(k, ls)).sort((a, b) => b.leads - a.leads);
  const sum = (k: "leads" | "booked" | "attended" | "no_show" | "won") => rows.reduce((n, r) => n + r[k], 0);
  const total: S["AppointmentFunnelRow"] = {
    campaign_id: null,
    campaign: "",
    leads: sum("leads"),
    booked: sum("booked"),
    attended: sum("attended"),
    no_show: sum("no_show"),
    won: sum("won"),
    show_rate: ratio(sum("attended"), sum("attended") + sum("no_show")),
    book_rate: ratio(sum("booked"), sum("leads")),
  };
  return { total, rows };
}

const appointmentHandlers = [
  http.get(url("/v1/clients/:id/booking"), ({ params }) => HttpResponse.json(mockBooking(String(params.id)))),
  http.put(url("/v1/clients/:id/booking"), async ({ params, request }) => {
    const body = (await request.json()) as S["BookingInput"];
    if (body.enabled && body.hosts.length === 0) return problem(422, "validation_failed", "Pick at least one host.");
    const b = { ...mockBooking(String(params.id)), ...body };
    mockBookings.set(String(params.id), b);
    return HttpResponse.json(b);
  }),
  http.post(url("/v1/clients/:id/booking/resources"), async ({ params, request }) => {
    const body = (await request.json()) as { name: string; kind: S["BookingResource"]["kind"] };
    const r: S["BookingResource"] = { id: db.newId(), name: body.name, kind: body.kind, active: true };
    mockBooking(String(params.id)).resources.push(r);
    return HttpResponse.json(r, { status: 201 });
  }),
  http.patch(url("/v1/booking/resources/:id"), async ({ params, request }) => {
    const { active } = (await request.json()) as { active: boolean };
    for (const b of mockBookings.values()) {
      const r = b.resources.find((x) => x.id === params.id);
      if (r) {
        r.active = active;
        return HttpResponse.json(r);
      }
    }
    return problem(404, "not_found", "Resource not found.");
  }),
  http.get(url("/v1/leads/:id/booking/slots"), ({ params }) => {
    const l = findLead(String(params.id));
    if (!l) return problem(404, "not_found", "Lead not found.");
    const b = mockBooking(l.client_id);
    return HttpResponse.json({
      enabled: b.enabled,
      timezone: b.timezone,
      title: b.title,
      duration_minutes: b.duration_minutes,
      slots: b.enabled ? mockSlots(l.client_id) : [],
    } satisfies S["Availability"]);
  }),
  http.get(url("/v1/leads/:id/appointments"), ({ params }) =>
    HttpResponse.json({
      data: appts()
        .filter((a) => a.lead_id === params.id)
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    }),
  ),
  http.post(url("/v1/leads/:id/appointments"), async ({ params, request }) => {
    await delay(300);
    const body = (await request.json()) as { starts_at: string; notes?: string; language?: string };
    const r = mockBook(String(params.id), body.starts_at, "agent", body.language);
    if (r instanceof Response) return r;
    return HttpResponse.json({ ...r, manage_url: `${location.origin}/appt/mock-appt-${r.id}` }, { status: 201 });
  }),
  http.post(url("/v1/leads/:id/booking-link"), ({ params }) =>
    HttpResponse.json({ url: `${location.origin}/book/mock-book-${String(params.id)}` }, { status: 201 }),
  ),
  http.get(url("/v1/appointments"), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const client = q.get("client_id");
    const mine = q.get("mine") === "true";
    return HttpResponse.json({
      data: appts()
        .filter((a) => (!client || a.client_id === client) && (!mine || a.host_user_id === db.me.user.id))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    });
  }),
  http.get(url("/v1/appointments/funnel"), ({ request }) =>
    HttpResponse.json(funnel(new URL(request.url).searchParams.get("client_id") ?? undefined)),
  ),
  http.post(url("/v1/appointments/:id/:action"), async ({ params, request }) => {
    const a = appts().find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Appointment not found.");
    if (params.action === "reschedule") {
      const { starts_at } = (await request.json()) as { starts_at: string };
      const r = mockBook(a.lead_id, starts_at, a.source, a.language, a.id);
      return r instanceof Response ? r : HttpResponse.json(r);
    }
    if (params.action === "cancel") a.status = "cancelled";
    if (params.action === "outcome") {
      if (Date.parse(a.starts_at) > db.now())
        return problem(409, "appointment_not_changeable", "The outcome can be recorded once it has started.");
      a.status = ((await request.json()) as { outcome: "attended" | "no_show" }).outcome;
    }
    saveAppts();
    return HttpResponse.json(a);
  }),
  http.get(url("/v1/me/calendar"), () => HttpResponse.json(mockCalendar)),
  http.post(url("/v1/me/calendar/connect"), async ({ request }) => {
    const { provider } = (await request.json()) as { provider: "google" | "microsoft" };
    return HttpResponse.json({
      authorize_url: `${location.origin}/en/settings/calendar/callback?code=mock-${provider}&state=mock`,
    });
  }),
  http.post(url("/v1/me/calendar/callback"), async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    const provider = code.endsWith("microsoft") ? "microsoft" : "google";
    mockCalendar = {
      ...mockCalendar,
      connected: true,
      provider,
      email: db.me.user.email,
      status: "active",
      error: null,
    };
    return HttpResponse.json(mockCalendar);
  }),
  http.delete(url("/v1/me/calendar"), () => {
    mockCalendar = { ...mockCalendar, connected: false, provider: null, email: null, status: null, error: null };
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/public/book/:token"), ({ params }) => {
    const token = String(params.token);
    const l = token.startsWith("mock-book-") ? findLead(token.slice(10)) : undefined;
    if (!l || !mockBooking(l.client_id).enabled) return problem(404, "not_found", "This link has expired.");
    const b = mockBooking(l.client_id);
    return HttpResponse.json({
      client: db.clients.find((c) => c.id === l.client_id)?.name ?? "",
      title: b.title,
      duration_minutes: b.duration_minutes,
      location: b.location,
      timezone: b.timezone,
      first_name: (l.full_name ?? "").split(" ")[0] ?? "",
      slots: mockSlots(l.client_id),
    } satisfies S["PublicBooking"]);
  }),
  http.post(url("/v1/public/book/:token"), async ({ params, request }) => {
    await delay(300);
    const token = String(params.token);
    const body = (await request.json()) as { starts_at: string; language?: string };
    if (!token.startsWith("mock-book-")) return problem(404, "not_found", "This link has expired.");
    const r = mockBook(token.slice(10), body.starts_at, "self", body.language);
    if (r instanceof Response) return r;
    return HttpResponse.json(publicView(r, `mock-appt-${r.id}`), { status: 201 });
  }),
  http.get(url("/v1/public/appointments/:token"), ({ params }) => {
    const a = apptByToken(String(params.token));
    return a ? HttpResponse.json(publicView(a)) : problem(404, "not_found", "We couldn't find this appointment.");
  }),
  http.get(url("/v1/public/appointments/:token/slots"), ({ params }) => {
    const a = apptByToken(String(params.token));
    if (!a) return problem(404, "not_found", "We couldn't find this appointment.");
    return HttpResponse.json({ data: publicView(a).can_reschedule ? mockSlots(a.client_id, a.id) : [] });
  }),
  http.post(url("/v1/public/appointments/:token/:action"), async ({ params, request }) => {
    const a = apptByToken(String(params.token));
    if (!a) return problem(404, "not_found", "We couldn't find this appointment.");
    if (params.action === "reschedule") {
      const { starts_at } = (await request.json()) as { starts_at: string };
      const r = mockBook(a.lead_id, starts_at, "self", a.language, a.id);
      return r instanceof Response ? r : HttpResponse.json(publicView(r, `mock-appt-${r.id}`));
    }
    if (params.action === "confirm" && a.status === "booked") a.status = "confirmed";
    if (params.action === "cancel") a.status = "cancelled";
    saveAppts();
    return HttpResponse.json(publicView(a));
  }),
];

// sessionStorage so recent questions survive a reload, like the real API.
const askHistory: S["AskAnswer"][] = (() => {
  try {
    return JSON.parse(sessionStorage.getItem("mock-ask") ?? "[]") as S["AskAnswer"][];
  } catch {
    return [];
  }
})();

function blankQuery(): S["AskQuery"] {
  return {
    kind: "leads",
    metrics: [],
    by: "",
    period: { preset: "", from: "", to: "" },
    filters: { client_id: "", campaign_id: "", source_id: "", owner: "", stages: [], overdue: false, quality: "" },
    sort: "",
    limit: 0,
  };
}

function interpret(question: string): { query: S["AskQuery"]; reason?: string } {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const query = blankQuery();
  const client = db.clients.find((c) => q.includes(c.name.toLowerCase().split(" ")[0]!));
  if (client) query.filters.client_id = client.id;
  if (has("this week", "এই সপ্তাহ", "هذا الأسبوع")) query.period.preset = "this_week";
  if (has("last month", "গত মাস", "الشهر الماضي")) query.period.preset = "last_month";
  if (has("this month", "এই মাস", "هذا الشهر")) query.period.preset = "this_month";
  if (has("30 days", "৩০ দিন", "30 يوم")) query.period.preset = "last_30_days";
  if (has("campaign", "ক্যাম্পেইন", "حملة")) {
    const won = has("won", "sale", "বিক্রি", "مكسوب", "مبيعات");
    Object.assign(query, { kind: "metrics", metrics: [won ? "won" : "leads"], by: "campaign" });
    if (has("most", "best", "সবচেয়ে", "أكثر")) Object.assign(query, { sort: won ? "won" : "leads", limit: 1 });
  } else if (has("agent", "এজেন্ট", "موظف")) {
    Object.assign(query, { kind: "metrics", metrics: ["contact_rate"], by: "owner" });
  } else if (has("per day", "দিনে", "يوميًا", "trend")) {
    Object.assign(query, { kind: "metrics", metrics: ["leads"], by: "day" });
  } else if (has("overdue", "দেরি", "متأخر")) {
    query.filters.overdue = true;
  } else if (has("new lead", "নতুন লিড", "جدد")) {
    query.filters.stages = ["new"];
  } else if (!has("lead", "লিড", "عملاء", "عميل")) {
    return { query: blankQuery(), reason: "This question isn't about leads, campaigns, the team or sales." };
  }
  if (query.kind === "metrics" && !query.period.preset) query.period.preset = "last_30_days";
  return { query };
}

function resolvePeriod(preset: string): { from: string; to: string } | null {
  const day = (offset: number) => new Date(db.now() + offset * 864e5).toISOString().slice(0, 10);
  const today = new Date(db.now());
  const month = (m: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, 1));
  switch (preset) {
    case "today":
      return { from: day(0), to: day(0) };
    case "yesterday":
      return { from: day(-1), to: day(-1) };
    case "this_week":
      return { from: day(-((today.getUTCDay() + 1) % 7)), to: day(0) }; // Saturday, like a Bangladeshi agency
    case "last_week": {
      const back = (today.getUTCDay() + 1) % 7;
      return { from: day(-back - 7), to: day(-back - 1) };
    }
    case "this_month":
      return { from: month(0).toISOString().slice(0, 10), to: day(0) };
    case "last_month":
      return {
        from: month(-1).toISOString().slice(0, 10),
        to: new Date(month(0).getTime() - 864e5).toISOString().slice(0, 10),
      };
    case "last_7_days":
      return { from: day(-6), to: day(0) };
    case "last_30_days":
      return { from: day(-29), to: day(0) };
    case "last_90_days":
    case "this_quarter":
      return { from: day(-89), to: day(0) };
    case "this_year":
      return { from: `${today.getUTCFullYear()}-01-01`, to: day(0) };
  }
  return null;
}

function runAsk(query: S["AskQuery"], question?: string): S["AskAnswer"] {
  const f = query.filters;
  const period = resolvePeriod(query.period.preset);
  const labels: Record<string, string> = {};
  if (f.client_id) labels[f.client_id] = db.clients.find((c) => c.id === f.client_id)?.name ?? "";
  if (f.campaign_id)
    labels[f.campaign_id] = db.leads.find((l) => l.campaign?.id === f.campaign_id)?.campaign?.name ?? "";
  const answer: S["AskAnswer"] = {
    question,
    answerable: true,
    query,
    labels,
    period: period ? { ...period, timezone: "Asia/Dhaka" } : null,
    notes: [],
  };
  if (query.kind === "leads") {
    const u = new URL("http://mock/v1/leads");
    if (f.client_id) u.searchParams.set("client_id", f.client_id);
    if (f.stages.length) u.searchParams.set("stage", f.stages.join(","));
    if (f.owner) u.searchParams.set("owner", f.owner === "me" ? db.me.user.id : f.owner);
    if (f.campaign_id) u.searchParams.set("campaign_id", f.campaign_id);
    if (f.overdue) u.searchParams.set("sla", "overdue");
    if (f.quality) u.searchParams.set("quality", f.quality);
    if (period) {
      u.searchParams.set("received_from", `${period.from}T00:00:00Z`);
      u.searchParams.set("received_to", `${period.to}T23:59:59Z`);
    }
    const rows = filterLeads(u);
    answer.leads = { count: rows.length, preview: rows.slice(0, 10).map(stripDetail) };
    return answer;
  }
  const p = period ?? resolvePeriod("last_30_days")!;
  const u = new URL("http://mock/v1/dashboard");
  u.searchParams.set("from", p.from);
  u.searchParams.set("to", p.to);
  if (f.client_id) u.searchParams.set("client_id", f.client_id);
  const d = dashboard(u);
  const pick = { none: [], day: d.by_day, client: d.by_client, campaign: d.by_campaign, owner: d.by_agent } as const;
  let rows = [...(pick[(query.by || "none") as keyof typeof pick] ?? [])];
  const k = d.kpis;
  const total: S["Breakdown"] = {
    id: null,
    name: "",
    leads_received: k.leads_received,
    leads_junk: k.leads_junk ?? 0,
    junk_rate: k.junk_rate ?? null,
    contact_rate: k.contact_rate,
    leads_won: k.leads_won,
    win_rate: k.win_rate,
    sla_compliance: k.sla_compliance,
    sla_breached: k.sla_breached,
    revenue_minor: k.revenue[0]?.amount_minor ?? 0,
    spend_minor: k.spend[0]?.amount_minor ?? 0,
    currency: "BDT",
  };
  const val = (b: S["Breakdown"]) =>
    query.sort === "won" ? b.leads_won : query.sort === "contact_rate" ? (b.contact_rate ?? -1) : b.leads_received;
  if (query.sort) rows.sort((a, b) => val(b) - val(a));
  if (query.limit) rows = rows.slice(0, query.limit);
  answer.metrics = { total, rows, currency: "BDT" };
  return answer;
}

const askHandlers = [
  http.post(url("/v1/ask"), async ({ request }) => {
    await delay(500);
    const { question } = (await request.json()) as { question: string };
    const { query, reason } = interpret(question);
    const answer = reason
      ? ({ question, answerable: false, reason, query, labels: {}, period: null, notes: [] } satisfies S["AskAnswer"])
      : runAsk(query, question);
    askHistory.unshift(answer);
    try {
      sessionStorage.setItem("mock-ask", JSON.stringify(askHistory.slice(0, 20)));
    } catch {
      // not persisted: fine for a demo
    }
    return HttpResponse.json(answer);
  }),
  http.post(url("/v1/ask/run"), async ({ request }) => {
    const { query } = (await request.json()) as { query: S["AskQuery"] };
    if (query.kind !== "leads" && query.kind !== "metrics")
      return problem(422, "validation_failed", "Unknown query kind.");
    return HttpResponse.json(runAsk(query));
  }),
  http.get(url("/v1/ask/history"), () =>
    HttpResponse.json({
      data: askHistory
        .filter((a, i) => askHistory.findIndex((b) => b.question === a.question) === i)
        .slice(0, 10)
        .map((a, i) => ({
          id: `ask-${i}`,
          question: a.question ?? "",
          query: a.query,
          answerable: a.answerable,
          asked_at: db.iso(db.now() - i * 60_000),
        })),
    }),
  ),
];

let mockOffline: S["OfflineSale"][] | null = null;
function offlineSales(): S["OfflineSale"][] {
  if (mockOffline) return mockOffline;
  const c = db.clients[0]!;
  const leadsOf = db.leads.filter((l) => l.client_id === c.id);
  const sale = (i: number, extra: Partial<S["OfflineSale"]>): S["OfflineSale"] => ({
    id: `offline-${i}`,
    client_id: c.id,
    channel: "csv",
    external_ref: `POS-${1040 + i}`,
    amount_minor: [1_250_000, 480_000, 2_200_000, 90_000][i % 4]!,
    currency: c.currency,
    sold_at: db.iso(db.now() - (i + 1) * 864e5),
    contact_hint: `…${4310 + i}`,
    customer_name: "",
    status: "matched",
    lead_id: leadsOf[i]?.id ?? null,
    confidence: 0.97,
    match_reason: "phone_and_email",
    sale_id: null,
    automatic: true,
    created_at: db.iso(db.now() - i * 3600_000),
    ...extra,
  });
  mockOffline = [
    sale(0, {}),
    sale(1, { match_reason: "phone", confidence: 0.9 }),
    sale(2, {
      status: "review",
      lead_id: leadsOf[2]?.id ?? null,
      confidence: 0.65,
      match_reason: "ambiguous",
      automatic: false,
      customer_name: "Rahima K.",
      suggestions: leadsOf.slice(2, 4).map((l) => ({
        lead_id: l.id,
        full_name: l.full_name,
        received_at: l.received_at,
        stage: l.stage,
        phone: true,
        email: false,
      })),
    }),
    sale(3, { status: "review", lead_id: null, confidence: 0, match_reason: "no_match", automatic: false }),
  ];
  return mockOffline;
}

let mockBenchOptIn = false;

const revintelHandlers = [
  http.get(url("/v1/offline-sales"), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const status = q.get("status");
    const client = q.get("client_id");
    return HttpResponse.json({
      data: offlineSales().filter((s) => (!status || s.status === status) && (!client || s.client_id === client)),
    });
  }),
  http.post(url("/v1/clients/:id/offline-sales/csv"), async () => {
    await delay(400);
    return HttpResponse.json({
      received: 12,
      matched: 9,
      review: 2,
      duplicates: 1,
      rejected: [],
    } satisfies S["OfflineImportResult"]);
  }),
  http.post(url("/v1/offline-sales/:id/:action"), async ({ params, request }) => {
    const s = offlineSales().find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Sale not found.");
    if (s.status !== "review") return problem(409, "offline_sale_not_reviewable", "This sale was already handled.");
    if (params.action === "match") {
      const { lead_id } = (await request.json()) as { lead_id: string };
      Object.assign(s, { status: "matched", lead_id, automatic: false, match_reason: "confirmed", confidence: 1 });
    } else {
      s.status = "ignored";
    }
    delete s.suggestions;
    return HttpResponse.json(s);
  }),
  http.get(url("/v1/leads/:id/prediction"), ({ params }) => {
    const l = findLead(String(params.id));
    if (!l) return problem(404, "not_found", "Lead not found.");
    if (l.stage === "won" || l.stage === "lost") return HttpResponse.json({ data: null });
    const p = 0.42;
    const value = 1_800_000;
    return HttpResponse.json({
      data: {
        lead_id: l.id,
        win_probability: p,
        value_minor: value,
        value_low: 1_100_000,
        value_high: 2_600_000,
        expected_minor: Math.round(value * p),
        currency: db.clients.find((c) => c.id === l.client_id)?.currency ?? "BDT",
        close_at: db.iso(db.now() + 9 * 864e5),
        close_low: db.iso(db.now() + 4 * 864e5),
        close_high: db.iso(db.now() + 21 * 864e5),
        basis: l.campaign ? "campaign" : "client",
        sample: l.campaign ? 7 : 42,
        version: "dv1",
        day: db.iso(db.now()).slice(0, 10),
      } satisfies S["DealPrediction"],
    });
  }),
  http.get(url("/v1/clients/:id/predictions/calibration"), ({ params }) =>
    HttpResponse.json({
      client_id: String(params.id),
      days: 180,
      version: "dv1",
      method:
        "Each lead closed in the period is compared with the first prediction made while it was still open. The Brier score is the mean squared error of the win probability (0 is perfect, 0.25 is a coin flip).",
      result: {
        leads: 64,
        brier: 0.162,
        value_error: 0.21,
        value_sample: 18,
        buckets: [
          { from: 0, to: 0.2, leads: 22, predicted: 0.11, actual: 0.09 },
          { from: 0.2, to: 0.4, leads: 19, predicted: 0.29, actual: 0.26 },
          { from: 0.4, to: 0.6, leads: 13, predicted: 0.5, actual: 0.54 },
          { from: 0.6, to: 0.8, leads: 10, predicted: 0.68, actual: 0.7 },
        ],
      },
    } satisfies S["PredictionCalibration"]),
  ),
  http.get(url("/v1/benchmarks/settings"), () => HttpResponse.json({ opt_in: mockBenchOptIn })),
  http.put(url("/v1/benchmarks/settings"), async ({ request }) => {
    mockBenchOptIn = ((await request.json()) as { opt_in: boolean }).opt_in;
    return HttpResponse.json({ opt_in: mockBenchOptIn });
  }),
  http.get(url("/v1/benchmarks"), ({ request }) => {
    const clientId = new URL(request.url).searchParams.get("client_id") ?? "";
    const c = db.clients.find((x) => x.id === clientId) ?? db.clients[0]!;
    const base = { country: c.country, industry: c.industry || "other", channel: "all", available: true, agencies: 14 };
    return HttpResponse.json({
      opted_in: mockBenchOptIn,
      client_id: clientId,
      period_end: mockBenchOptIn ? db.iso(db.now()).slice(0, 10) : null,
      leads: mockBenchOptIn ? 186 : 0,
      methodology:
        "Agencies that opted in contribute de-identified figures for their leads of the last 90 days. A group is shown only when at least 10 agencies with at least 20 leads each are in it; only its deciles are kept.",
      metrics: mockBenchOptIn
        ? [
            { ...base, metric: "speed_to_lead", value: 252, beats: 0.78, p10: 180, median: 1260, p90: 9800 },
            { ...base, metric: "contact_rate", value: 0.91, beats: 0.64, p10: 0.55, median: 0.82, p90: 0.97 },
            {
              ...base,
              metric: "win_rate",
              value: 0.24,
              available: false,
              reason: "not_enough_agencies",
              beats: null,
              p10: null,
              median: null,
              p90: null,
              agencies: 0,
            },
          ]
        : [],
    } satisfies S["Benchmarks"]);
  }),
];

// Share tokens: "mock-audit-<id>" / "mock-review-<id>" survive a fresh load.
function sampleReport(withMoney: boolean): S["AuditReport"] {
  const days = 14;
  return {
    from: db.iso(db.now() - days * 864e5),
    to: db.iso(db.now()),
    days,
    leads: 212,
    responded: 171,
    never: 41,
    median_seconds: 2280,
    p90_seconds: 61200,
    buckets: [
      { key: "under_5m", leads: 38, share: 0.18 },
      { key: "5m_30m", leads: 52, share: 0.25 },
      { key: "30m_2h", leads: 39, share: 0.18 },
      { key: "2h_24h", leads: 33, share: 0.16 },
      { key: "over_24h", leads: 9, share: 0.04 },
      { key: "never", leads: 41, share: 0.19 },
    ],
    business_hours: { leads: 141, median_seconds: 1140, never_rate: 0.12 },
    after_hours: { leads: 71, median_seconds: 39600, never_rate: 0.33 },
    by_source: [
      { source: "facebook", leads: 148, never_rate: 0.14, median_seconds: 1800 },
      { source: "website", leads: 64, never_rate: 0.31, median_seconds: 3900 },
    ],
    with_outcome: 70,
    lost_sales: { low: 9.4, high: 31.6 },
    lost_revenue_minor: withMoney ? { low: 4_700_000, high: 47_400_000 } : null,
    lost_revenue_per_month: withMoney ? { low: 10_071_429, high: 101_571_429 } : null,
    close_rate: { low: 0.15, high: 0.3 },
    close_rate_from: "industry",
    assumptions: [
      { key: "close_rate", value: "industry" },
      { key: "decay", value: "buckets" },
      { key: "business_hours", value: "10:00-19:00" },
      { key: "deal_value", value: withMoney ? "entered" : "missing" },
    ],
    fixes: [
      { key: "contact_everyone", priority: 1, params: { never_rate: "0.19" } },
      { key: "respond_fast", priority: 2, params: { median_seconds: "2280" } },
      { key: "after_hours", priority: 3, params: { after_hours_leads: "71", median_seconds: "39600" } },
      { key: "worst_source", priority: 4, params: { source: "website", never_rate: "0.31" } },
      { key: "track_outcomes", priority: 5, params: {} },
    ],
  };
}

function newAudit(id: string, name: string, extra: Partial<S["LeakageAudit"]> = {}): S["LeakageAudit"] {
  return {
    id,
    prospect_name: name,
    industry: "clinic",
    country: "BD",
    currency: "BDT",
    timezone: "Asia/Dhaka",
    consent_name: "Dr. Farhana Akter",
    consent_email: "farhana@smileclinic.test",
    consent_at: db.iso(db.now() - 3 * 864e5),
    status: "collecting",
    expires_at: db.iso(db.now() + 11 * 864e5),
    deal_value_low: null,
    deal_value_high: null,
    close_rate_low: null,
    close_rate_high: null,
    business_hours: { from: "10:00", to: "19:00" },
    shared: false,
    converted_client_id: null,
    leads: 212,
    created_at: db.iso(db.now() - 3 * 864e5),
    report: sampleReport(false),
    ...extra,
  };
}

const mockAudits: S["LeakageAudit"][] = [
  newAudit("audit-smile", "Smile Clinic Uttara"),
  newAudit("audit-prime", "Prime Realty", {
    industry: "real_estate",
    status: "deleted",
    consent_at: db.iso(db.now() - 30 * 864e5),
    expires_at: db.iso(db.now() - 16 * 864e5),
  }),
];

function reviewFacts(currency: string): S["ReviewFact"][] {
  const fact = (
    key: string,
    metric: string,
    kind: S["ReviewFact"]["kind"],
    value: number | null,
    scope: string,
    label?: string,
  ) => ({
    key,
    metric,
    kind,
    value,
    scope,
    ...(kind === "money" ? { currency } : {}),
    ...(label ? { label } : {}),
  });
  const month = new Date(db.now());
  const from = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 0)).toISOString().slice(0, 10);
  return [
    { key: "period", metric: "", kind: "period", value: null, scope: "current", label: `${from}/${to}` },
    fact("leads.current", "leads", "count", 184, "current"),
    fact("leads.previous", "leads", "count", 156, "previous"),
    fact("leads.change", "leads", "change", 0.179, "change"),
    fact("won.current", "won", "count", 31, "current"),
    fact("won.change", "won", "change", 0.24, "change"),
    fact("contact_rate.current", "contact_rate", "rate", 0.86, "current"),
    fact("sla_compliance.current", "sla_compliance", "rate", 0.71, "current"),
    fact("sla_compliance.change", "sla_compliance", "points", -0.04, "change"),
    fact("revenue.current", "revenue", "money", 412_500_000, "current"),
    { key: "campaign_1.name", metric: "", kind: "text", value: null, scope: "campaign", label: "Eid Implant Offer" },
    fact("campaign_1.won", "won", "count", 14, "campaign", "Eid Implant Offer"),
  ];
}

const mockReviews: S["BusinessReview"][] = [];
function reviewsFor(clientId: string) {
  if (!mockReviews.some((r) => r.client_id === clientId)) {
    const c = db.clients.find((x) => x.id === clientId);
    const facts = reviewFacts(c?.currency ?? "BDT");
    mockReviews.push({
      id: `review-${clientId}`,
      client_id: clientId,
      kind: "monthly",
      period_from: facts[0]!.label!.split("/")[0]!,
      period_to: facts[0]!.label!.split("/")[1]!,
      language: "en",
      status: "draft",
      facts,
      content: {
        headline: "More leads and more wins in {{period}}",
        sections: [
          {
            title: "Results",
            body: "You received {{leads.current}} leads ({{leads.change}} on the month before) and won {{won.current}} of them, bringing in {{revenue.current}}.",
          },
          {
            title: "What worked",
            body: "{{campaign_1.name}} was the strongest campaign with {{campaign_1.won}} wins.",
          },
          {
            title: "What held results back",
            body: "Only {{sla_compliance.current}} of leads were answered on time ({{sla_compliance.change}}).",
          },
        ],
        recommendations: [
          "Add an evening auto-reply so late enquiries are answered at once.",
          "Put more budget behind {{campaign_1.name}}.",
        ],
      },
      edited: false,
      approved_at: null,
      shared: false,
      created_at: db.iso(db.now() - 864e5),
    });
  }
  return mockReviews.filter((r) => r.client_id === clientId);
}

const REF_RE = /\{\{\s*[a-z0-9_.:-]+\s*\}\}/g;

const auditHandlers = [
  http.get(url("/v1/audits"), () => HttpResponse.json({ data: mockAudits })),
  http.post(url("/v1/audits"), async ({ request }) => {
    const b = (await request.json()) as {
      prospect_name: string;
      industry?: string;
      country: string;
      consent_name: string;
      consent_email: string;
    };
    const a = newAudit(`audit-${mockAudits.length + 1}`, b.prospect_name, {
      industry: b.industry ?? "other",
      country: b.country,
      consent_name: b.consent_name,
      consent_email: b.consent_email,
      consent_at: db.iso(db.now()),
      expires_at: db.iso(db.now() + 14 * 864e5),
      created_at: db.iso(db.now()),
      leads: 0,
      report: { ...sampleReport(false), leads: 0, responded: 0, never: 0 },
    });
    mockAudits.unshift(a);
    return HttpResponse.json(a, { status: 201 });
  }),
  http.get(url("/v1/audits/:id"), ({ params }) => {
    const a = mockAudits.find((x) => x.id === params.id);
    return a ? HttpResponse.json(a) : problem(404, "not_found", "Audit not found.");
  }),
  http.delete(url("/v1/audits/:id"), ({ params }) => {
    const i = mockAudits.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Audit not found.");
    mockAudits.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/audits/:id/leads/csv"), async ({ params }) => {
    await delay(300);
    const a = mockAudits.find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Audit not found.");
    a.leads = 212;
    a.report = sampleReport(a.deal_value_low != null);
    return HttpResponse.json({ received: 213, added: 212, duplicates: 1, rejected: [] } satisfies S["AuditImport"]);
  }),
  http.put(url("/v1/audits/:id/assumptions"), async ({ params, request }) => {
    const a = mockAudits.find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Audit not found.");
    const b = (await request.json()) as {
      deal_value_low: number | null;
      deal_value_high: number | null;
      business_hours: { from: string; to: string };
    };
    if ((b.deal_value_low == null) !== (b.deal_value_high == null))
      return problem(422, "validation_failed", "Give both ends of the range.");
    Object.assign(a, {
      deal_value_low: b.deal_value_low,
      deal_value_high: b.deal_value_high,
      business_hours: b.business_hours,
    });
    if (a.leads > 0) a.report = sampleReport(b.deal_value_low != null);
    return HttpResponse.json(a);
  }),
  http.post(url("/v1/audits/:id/:action"), async ({ params, request }) => {
    const a = mockAudits.find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Audit not found.");
    if (params.action === "share") {
      a.shared = true;
      return HttpResponse.json({ url: `${location.origin}/audit/mock-audit-${a.id}` });
    }
    if (params.action === "convert") {
      const { client_id } = (await request.json()) as { client_id: string };
      Object.assign(a, { status: "converted", converted_client_id: client_id });
      return HttpResponse.json(a);
    }
    return problem(404, "not_found", "Unknown action.");
  }),
  http.get(url("/v1/public/audits/:token"), ({ params }) => {
    const id = String(params.token).replace(/^mock-audit-/, "");
    const a = mockAudits.find((x) => x.id === id);
    if (!a?.report) return problem(404, "not_found", "This report link doesn't exist.");
    return HttpResponse.json({
      agency: db.agency.name,
      prospect_name: a.prospect_name,
      industry: a.industry,
      country: a.country,
      currency: a.currency,
      timezone: a.timezone,
      report: a.report,
      brand: brandIfSet(),
    });
  }),
  http.get(url("/v1/clients/:id/business-reviews"), ({ params }) =>
    HttpResponse.json({ data: reviewsFor(String(params.id)) }),
  ),
  http.post(url("/v1/clients/:id/business-reviews"), async ({ params, request }) => {
    await delay(600);
    const b = (await request.json()) as { kind: "monthly" | "quarterly"; language?: string };
    const base = reviewsFor(String(params.id))[0]!;
    const r: S["BusinessReview"] = {
      ...structuredClone(base),
      id: `review-${db.newId()}`,
      kind: b.kind,
      language: b.language ?? "en",
      status: "draft",
      edited: false,
      shared: false,
      approved_at: null,
      created_at: db.iso(db.now()),
    };
    mockReviews.unshift(r);
    return HttpResponse.json(r, { status: 201 });
  }),
  http.put(url("/v1/business-reviews/:id"), async ({ params, request }) => {
    const r = mockReviews.find((x) => x.id === params.id);
    if (!r) return problem(404, "not_found", "Review not found.");
    const { content } = (await request.json()) as { content: S["ReviewContent"] };
    const texts: [string, string][] = [
      ["content.headline", content.headline],
      ...content.sections.flatMap((s, i): [string, string][] => [
        [`content.sections[${i}].title`, s.title],
        [`content.sections[${i}].body`, s.body],
      ]),
      ...content.recommendations.map((x, i): [string, string] => [`content.recommendations[${i}]`, x]),
    ];
    const errors = texts
      .filter(([, text]) => /\p{Nd}/u.test(text.replace(REF_RE, "")))
      .map(([field, text]) => ({
        field,
        code: "literal_number",
        message: text.replace(REF_RE, "").trim().slice(0, 40),
      }));
    if (errors.length)
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Numbers must be fact references.",
          errors,
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    Object.assign(r, { content, edited: true, status: "draft", approved_at: null, shared: false });
    return HttpResponse.json(r);
  }),
  http.post(url("/v1/business-reviews/:id/:action"), ({ params }) => {
    const r = mockReviews.find((x) => x.id === params.id);
    if (!r) return problem(404, "not_found", "Review not found.");
    if (params.action === "approve") {
      Object.assign(r, { status: "approved", approved_at: db.iso(db.now()) });
      return HttpResponse.json(r);
    }
    if (r.status !== "approved") return problem(409, "review_not_approved", "Approve the review before sharing it.");
    r.shared = true;
    return HttpResponse.json({ url: `${location.origin}/qbr/mock-review-${r.client_id}` });
  }),
  http.get(url("/v1/public/business-reviews/:token"), ({ params }) => {
    const clientId = String(params.token).replace(/^mock-review-/, "");
    const c = db.clients.find((x) => x.id === clientId);
    if (!c) return problem(404, "not_found", "This review link doesn't exist.");
    const r = reviewsFor(clientId)[0]!;
    return HttpResponse.json({
      agency: db.agency.name,
      client: c.name,
      review: { ...r, status: "approved", shared: true },
      brand: brandIfSet(),
    });
  }),
];

// Brand kept in sessionStorage so portal pages (a fresh load) see it.
function loadBrand(): S["Brand"] {
  try {
    const raw = sessionStorage.getItem("mock-brand");
    if (raw) return JSON.parse(raw) as S["Brand"];
  } catch {
    // private mode: defaults
  }
  return {
    slug: db.agency.slug,
    agency_name: db.agency.name,
    display_name: db.agency.name,
    primary_color: "",
    primary_text: "",
    accent_color: "",
    font: "system",
    support_email: "",
    logo_url: null,
  };
}
let mockBrand: S["Brand"] | null = null;
const brand = () => (mockBrand ??= loadBrand());
function saveBrand() {
  try {
    sessionStorage.setItem("mock-brand", JSON.stringify(brand()));
  } catch {
    // not persisted: fine for a demo
  }
}
function luminanceOf(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function brandIfSet() {
  const b = brand();
  return b.primary_color || b.logo_url || b.display_name !== b.agency_name ? b : null;
}

let mockDomains: S["CustomDomain"][] = [];
const mockSSOProvider: S["SSOServiceProvider"] = {
  oidc_redirect_url: "https://app.leadexpa.app/en/sso/callback",
  saml_entity_id: "https://api.leadexpa.app/v1/auth/sso/saml/mock/metadata",
  saml_acs_url: "https://api.leadexpa.app/v1/auth/sso/saml/mock/acs",
  saml_metadata_url: "https://api.leadexpa.app/v1/auth/sso/saml/mock/metadata",
  scim_base_url: "https://api.leadexpa.app/scim/v2",
};
const mockSSO: {
  domains: S["SSODomain"][];
  connection: S["SSOConnection"] | null;
  tokens: S["SCIMTokenInfo"][];
  groups: S["SSOGroupMapping"][];
} = {
  domains: [],
  connection: null,
  tokens: [],
  groups: [
    {
      id: "0190f0f0-0000-7000-8000-00000000a001",
      display_name: "Sales Managers",
      external_id: "okta-00g1",
      role: "manager",
      member_count: 3,
      updated_at: "2026-10-01T09:00:00Z",
    },
    {
      id: "0190f0f0-0000-7000-8000-00000000a002",
      display_name: "Sales Floor",
      external_id: "okta-00g2",
      role: null,
      member_count: 12,
      updated_at: "2026-10-01T09:00:00Z",
    },
  ],
};
function mockSPCert(prefix: string, rotatedAt: string | null): S["SAMLSPCert"] {
  return {
    pem: `-----BEGIN CERTIFICATE-----
MIIC${prefix.replace(":", "")}mockCertificate
-----END CERTIFICATE-----
`,
    fingerprint_sha256: `${prefix}:${"12:".repeat(29)}34`,
    expires_at: "2036-10-14T00:00:00Z",
    rotated_at: rotatedAt,
    previous_key_active: rotatedAt !== null,
  };
}
let mockSenders: S["SenderDomain"][] = [];

const brandHandlers = [
  http.get(url("/v1/branding"), () => HttpResponse.json(brand())),
  http.put(url("/v1/branding"), async ({ request }) => {
    const b = (await request.json()) as Partial<S["Brand"]>;
    const primary = (b.primary_color ?? "").toLowerCase();
    if (primary && 1.05 / (luminanceOf(primary) + 0.05) < 4.5)
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Unreadable colour.",
          errors: [{ field: "primary_color", code: "brand_color_unreadable", message: "contrast too low" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    Object.assign(brand(), {
      display_name: b.display_name || db.agency.name,
      primary_color: primary,
      primary_text: primary ? "#ffffff" : "",
      accent_color: (b.accent_color ?? "").toLowerCase(),
      font: b.font || "system",
      support_email: b.support_email ?? "",
    });
    saveBrand();
    return HttpResponse.json(brand());
  }),
  http.post(url("/v1/branding/logo"), async ({ request }) => {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return problem(400, "brand_logo_invalid", "Use a PNG, JPEG or WebP image.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    bytes.forEach((x) => (bin += String.fromCharCode(x)));
    brand().logo_url = `data:${file.type};base64,${btoa(bin)}`;
    saveBrand();
    return HttpResponse.json(brand());
  }),
  http.delete(url("/v1/branding/logo"), () => {
    brand().logo_url = null;
    saveBrand();
    return HttpResponse.json(brand());
  }),
  http.get(url("/v1/public/brand/:slug"), ({ params }) =>
    params.slug === db.agency.slug ? HttpResponse.json(brand()) : problem(404, "not_found", "Not found."),
  ),
  // Verify "finds" the records, except hosts starting with "wrong.".
  http.get(url("/v1/domains"), () => HttpResponse.json({ data: mockDomains })),
  http.post(url("/v1/domains"), async ({ request }) => {
    const { hostname } = (await request.json()) as { hostname: string };
    const host = hostname
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[/?#].*$/, "")
      .replace(/\.$/, "");
    if (
      !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) ||
      host.endsWith("leadexpa.app")
    )
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Invalid domain.",
          errors: [{ field: "hostname", code: "domain_invalid", message: "a domain you own" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    if (mockDomains.some((d) => d.hostname === host)) return problem(409, "domain_taken", "Already connected.");
    if (mockDomains.length >= 3) return problem(409, "domain_limit", "At most three.");
    const d: S["CustomDomain"] = {
      id: crypto.randomUUID(),
      hostname: host,
      status: "pending",
      error: null,
      records: [
        { type: "TXT", name: `_leadexpa-challenge.${host}`, value: "leadexpa-verify=mock7Qx2", ok: false },
        { type: "CNAME", name: host, value: "domains.leadexpa.app", ok: false },
      ],
      last_checked_at: null,
      verified_at: null,
      created_at: new Date().toISOString(),
    };
    mockDomains.push(d);
    return HttpResponse.json(d, { status: 201 });
  }),
  http.post(url("/v1/domains/:id/verify"), ({ params }) => {
    const d = mockDomains.find((x) => x.id === params.id);
    if (!d) return problem(404, "not_found", "Domain not found.");
    const now = new Date().toISOString();
    const wrong = d.hostname.startsWith("wrong.");
    d.status = wrong ? "failed" : "verified";
    d.error = wrong ? "cname_wrong" : null;
    d.records = d.records.map((r) => ({ ...r, ok: r.type === "TXT" || !wrong }));
    d.last_checked_at = now;
    d.verified_at = wrong ? null : now;
    return HttpResponse.json(d);
  }),
  http.delete(url("/v1/domains/:id"), ({ params }) => {
    mockDomains = mockDomains.filter((x) => x.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/sender-domains"), () => HttpResponse.json({ data: mockSenders })),
  http.post(url("/v1/sender-domains"), async ({ request }) => {
    const b = (await request.json()) as { domain: string; from_local?: string };
    const dom = b.domain.trim().toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dom))
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Invalid domain.",
          errors: [{ field: "domain", code: "domain_invalid", message: "your email domain" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    if (mockSenders.some((d) => d.domain === dom)) return problem(409, "domain_taken", "Already added.");
    const local = (b.from_local || "hello").toLowerCase();
    const d: S["SenderDomain"] = {
      id: crypto.randomUUID(),
      domain: dom,
      from_address: `${local}@${dom}`,
      status: "pending",
      records: [
        { type: "TXT", name: dom, value: "v=spf1 include:_spf.leadexpa.app ~all", ok: false },
        { type: "CNAME", name: `leadexpa._domainkey.${dom}`, value: "dkim.leadexpa.app", ok: false },
        { type: "TXT", name: `_dmarc.${dom}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${dom}`, ok: false },
      ],
      last_checked_at: null,
      verified_at: null,
      created_at: new Date().toISOString(),
    };
    mockSenders.push(d);
    return HttpResponse.json(d, { status: 201 });
  }),
  http.post(url("/v1/sender-domains/:id/verify"), ({ params }) => {
    const d = mockSenders.find((x) => x.id === params.id);
    if (!d) return problem(404, "not_found", "Domain not found.");
    const now = new Date().toISOString();
    Object.assign(d, { status: "verified", last_checked_at: now, verified_at: now });
    d.records = d.records.map((r) => ({ ...r, ok: true }));
    return HttpResponse.json(d);
  }),
  http.delete(url("/v1/sender-domains/:id"), ({ params }) => {
    mockSenders = mockSenders.filter((x) => x.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/public/brand-by-domain"), ({ request }) => {
    const host = new URL(request.url).searchParams.get("host");
    return mockDomains.some((d) => d.hostname === host && d.status === "verified")
      ? HttpResponse.json(brand())
      : problem(404, "not_found", "Not found.");
  }),
  // Verify always finds the TXT record; gmail.com is refused.
  http.get(url("/v1/sso/domains"), () => HttpResponse.json({ data: mockSSO.domains })),
  http.post(url("/v1/sso/domains"), async ({ request }) => {
    const { domain } = (await request.json()) as { domain: string };
    const d = domain.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) || d === "gmail.com")
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Invalid domain.",
          errors: [{ field: "domain", code: "invalid", message: "a domain you own, like clinic.com" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    const row: S["SSODomain"] = {
      id: crypto.randomUUID(),
      domain: d,
      status: "pending",
      record_name: `_leadexpa-sso.${d}`,
      record_value: "leadexpa-sso=mockA1b2",
      verified_at: null,
      last_checked_at: null,
    };
    mockSSO.domains.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  http.post(url("/v1/sso/domains/:id/verify"), ({ params }) => {
    const d = mockSSO.domains.find((x) => x.id === params.id);
    if (!d) return problem(404, "not_found", "Domain not found.");
    d.status = "verified";
    d.verified_at = d.last_checked_at = new Date().toISOString();
    return HttpResponse.json(d);
  }),
  http.delete(url("/v1/sso/domains/:id"), ({ params }) => {
    mockSSO.domains = mockSSO.domains.filter((x) => x.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/sso/connection"), () => HttpResponse.json({ connection: mockSSO.connection, sp: mockSSOProvider })),
  http.put(url("/v1/sso/connection"), async ({ request }) => {
    const b = (await request.json()) as S["SSOConnectionInput"];
    const secretSet = !!b.oidc_client_secret || !!mockSSO.connection?.oidc_client_secret_set;
    if (b.protocol === "oidc" && !b.oidc_issuer?.startsWith("https://"))
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Invalid settings.",
          errors: [{ field: "oidc_issuer", code: "invalid", message: "the identity provider's https issuer URL" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    mockSSO.connection = {
      protocol: b.protocol,
      enabled: b.enabled ?? false,
      enforce: b.enforce ?? false,
      jit: b.jit ?? false,
      default_role: b.default_role ?? "agent",
      oidc_issuer: b.oidc_issuer ?? "",
      oidc_client_id: b.oidc_client_id ?? "",
      oidc_client_secret_set: b.protocol === "oidc" && secretSet,
      saml_idp_entity_id: b.saml_idp_entity_id ?? "",
      saml_idp_sso_url: b.saml_idp_sso_url ?? "",
      saml_idp_cert: b.saml_idp_cert ?? "",
      saml_sign_requests: b.saml_sign_requests ?? false,
      saml_allow_idp_initiated: b.saml_allow_idp_initiated ?? false,
      saml_sp_cert: b.protocol === "saml" ? (mockSSO.connection?.saml_sp_cert ?? mockSPCert("AB:CD", null)) : null,
      updated_at: new Date().toISOString(),
      sp: mockSSOProvider,
    };
    return HttpResponse.json(mockSSO.connection);
  }),
  http.post(url("/v1/sso/connection/sp-key/rotate"), () => {
    const conn = mockSSO.connection;
    if (conn?.protocol !== "saml")
      return problem(409, "conflict", "Only a SAML connection has a service-provider certificate.");
    conn.saml_sp_cert = mockSPCert("EF:01", new Date().toISOString());
    return HttpResponse.json(conn);
  }),
  http.delete(url("/v1/sso/connection"), () => {
    mockSSO.connection = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/sso/scim-tokens"), () => HttpResponse.json({ data: mockSSO.tokens })),
  http.post(url("/v1/sso/scim-tokens"), async ({ request }) => {
    const { name } = (await request.json()) as { name: string };
    const tok: S["SCIMTokenInfo"] = {
      id: crypto.randomUUID(),
      name,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };
    mockSSO.tokens.push(tok);
    return HttpResponse.json(
      { ...tok, token: "scim_mockTokenValue123", base_url: mockSSOProvider.scim_base_url },
      { status: 201 },
    );
  }),
  http.delete(url("/v1/sso/scim-tokens/:id"), ({ params }) => {
    mockSSO.tokens = mockSSO.tokens.filter((x) => x.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/sso/groups"), () => HttpResponse.json({ data: mockSSO.groups })),
  http.put(url("/v1/sso/groups/:id/role"), async ({ params, request }) => {
    const { role } = (await request.json()) as { role: S["SSOGroupMapping"]["role"] };
    const g = mockSSO.groups.find((x) => x.id === params.id);
    if (!g) return problem(404, "not_found", "Group not found.");
    Object.assign(g, { role, updated_at: new Date().toISOString() });
    return HttpResponse.json(g);
  }),
  // Emails on "sso.test" have an IdP; the mock provider redirects straight back.
  http.post(url("/v1/auth/sso/start"), async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    if (!email.toLowerCase().endsWith("@sso.test"))
      return problem(400, "sso_not_configured", "Single sign-on isn't set up for this email.");
    return HttpResponse.json({ redirect_url: "/en/sso/callback?code=mock-code&state=mock-state" });
  }),
  http.post(url("/v1/auth/sso/oidc/callback"), () => HttpResponse.json({ me: currentMe(), return_to: "" })),
  // Access policy (G7b): IPv4 addresses and ranges no wider than /8.
  http.get(url("/v1/agencies/current/access-policy"), () => HttpResponse.json(mockAccess.policy)),
  http.put(url("/v1/agencies/current/access-policy"), async ({ request }) => {
    const b = (await request.json()) as Omit<S["AccessPolicy"], "your_ip">;
    const list: string[] = [];
    for (const [i, raw] of b.ip_allowlist.entries()) {
      const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(raw.trim());
      if (!m || Number(m[2] ?? 32) < 8)
        return HttpResponse.json(
          {
            type: "about:blank",
            title: "validation_failed",
            status: 422,
            code: "validation_failed",
            detail: "Invalid network.",
            errors: [{ field: `ip_allowlist.${i}`, code: "cidr", message: "an IP address or range" }],
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        );
      list.push(`${m[1]}/${m[2] ?? 32}`);
    }
    mockAccess.policy = { ...b, ip_allowlist: [...new Set(list)], your_ip: mockAccess.policy.your_ip };
    return HttpResponse.json(mockAccess.policy);
  }),
];

// sessionStorage: shared report pages are a fresh load.
type RbRun = S["ReportRunSummary"] & { template_id: string; view: S["PublicReportRun"] };
type RbState = { templates: S["ReportTemplate"][]; schedules: S["ReportSchedule"][]; runs: RbRun[] };
let rbState: RbState | null = null;
function rb(): RbState {
  if (rbState) return rbState;
  try {
    const raw = sessionStorage.getItem("mock-rb");
    if (raw) return (rbState = JSON.parse(raw) as RbState);
  } catch {
    // private mode: start fresh
  }
  const at = db.iso(db.now() - 3 * 864e5);
  rbState = {
    templates: [
      {
        id: "rbt-demo",
        name: "Monthly client results",
        description: "What we send every client on the 1st.",
        widgets: fromStarter("monthly"),
        created_by: db.me.user.id,
        created_at: at,
        updated_at: at,
      },
    ],
    schedules: [],
    runs: [],
  };
  return rbState;
}
function saveRb() {
  try {
    sessionStorage.setItem("mock-rb", JSON.stringify(rb()));
  } catch {
    // not persisted: fine for a demo
  }
}

function rbInvalid(widgets: S["ReportWidget"][]) {
  if (widgets.length > 24) return "At most 24 widgets.";
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i]!;
    if (rbProblem(w)) return `widgets.${i}: doesn't fit a ${w.type} widget.`;
    for (let j = i + 1; j < widgets.length; j++)
      if (rbOverlaps(w.layout, widgets[j]!.layout)) return `widgets.${j}.layout: overlaps widget "${w.id}".`;
  }
  return null;
}

function rbRun(
  widgets: S["ReportWidget"][],
  clientId: string | null,
  period: S["AskPeriod"],
): S["ReportBuilderResult"] {
  const out: S["ReportBuilderResult"] = { period: null, client: null, results: [] };
  const preset = period.preset || "last_30_days";
  for (const w of widgets) {
    if (!w.query) {
      out.results.push({ id: w.id, notes: [] });
      continue;
    }
    const a = runAsk({
      ...w.query,
      period: { preset, from: "", to: "" },
      filters: { ...w.query.filters, client_id: clientId ?? "" },
    });
    out.period ??= a.period ?? null;
    out.results.push({ id: w.id, notes: a.notes, metrics: a.metrics, leads: a.leads });
  }
  if (clientId) out.client = db.clients.find((c) => c.id === clientId)?.name ?? null;
  return out;
}

function rbNextRun(cadence: string, hour: number) {
  const d = new Date(db.now());
  for (let i = 1; i < 40; i++) {
    const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + i, hour));
    if (cadence === "monthly" ? c.getUTCDate() === 1 : c.getUTCDay() === 6) return c.toISOString();
  }
  return db.iso(db.now() + 7 * 864e5);
}

function rbShare(
  t: S["ReportTemplate"],
  clientId: string,
  period: S["AskPeriod"],
  locale: string,
  scheduleId: string | null,
) {
  const res = rbRun(t.widgets, clientId, period);
  const id = `rbr${Date.now().toString(36)}${rb().runs.length}`;
  const p = res.period ?? { from: "", to: "", timezone: "UTC" };
  const view: S["PublicReportRun"] = {
    name: t.name,
    client: res.client ?? "",
    agency: db.agency.name,
    locale,
    period_from: p.from,
    period_to: p.to,
    created_at: new Date().toISOString(),
    brand: brandIfSet(),
    snapshot: {
      widgets: t.widgets.map((w, i) => {
        const r = res.results[i]!;
        return {
          ...w,
          query: w.query ? { ...w.query, filters: { ...w.query.filters, client_id: "" } } : null,
          ...(r.metrics ? { metrics: r.metrics } : {}),
          ...(r.leads ? { count: r.leads.count } : {}),
        };
      }),
    },
  };
  const expires = db.iso(db.now() + 180 * 864e5);
  rb().runs.unshift({
    id,
    template_id: t.id,
    schedule_id: scheduleId,
    client_id: clientId,
    locale,
    period_from: p.from,
    period_to: p.to,
    expires_at: expires,
    created_at: view.created_at,
    view,
  });
  saveRb();
  const origin = typeof location === "undefined" ? "" : location.origin;
  return { id, url: `${origin}/${locale}/rb/mock-rb-${id}`, expires_at: expires } satisfies S["ReportRunShare"];
}

const rbHandlers = [
  http.get(url("/v1/report-templates"), () => HttpResponse.json({ data: rb().templates })),
  http.post(url("/v1/report-templates"), async ({ request }) => {
    const body = (await request.json()) as S["ReportTemplateInput"];
    const bad = rbInvalid(body.widgets);
    if (bad) return problem(422, "validation_failed", bad);
    const now = new Date().toISOString();
    const t: S["ReportTemplate"] = {
      id: `rbt-${Date.now().toString(36)}`,
      name: body.name.trim(),
      description: body.description ?? "",
      widgets: body.widgets,
      created_by: db.me.user.id,
      created_at: now,
      updated_at: now,
    };
    rb().templates.unshift(t);
    saveRb();
    return HttpResponse.json(t, { status: 201 });
  }),
  http.get(url("/v1/report-templates/:id"), ({ params }) => {
    const t = rb().templates.find((x) => x.id === params.id);
    return t ? HttpResponse.json(t) : problem(404, "not_found", "Report not found.");
  }),
  http.put(url("/v1/report-templates/:id"), async ({ params, request }) => {
    const t = rb().templates.find((x) => x.id === params.id);
    if (!t) return problem(404, "not_found", "Report not found.");
    const body = (await request.json()) as S["ReportTemplateInput"];
    const bad = rbInvalid(body.widgets);
    if (bad) return problem(422, "validation_failed", bad);
    Object.assign(t, {
      name: body.name.trim(),
      description: body.description ?? "",
      widgets: body.widgets,
      updated_at: new Date().toISOString(),
    });
    saveRb();
    return HttpResponse.json(t);
  }),
  http.delete(url("/v1/report-templates/:id"), ({ params }) => {
    const s = rb();
    s.templates = s.templates.filter((x) => x.id !== params.id);
    s.schedules = s.schedules.filter((x) => x.template_id !== params.id);
    saveRb();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/report-builder/run"), async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as {
      widgets: S["ReportWidget"][];
      client_id?: string | null;
      period?: S["AskPeriod"];
    };
    const bad = rbInvalid(body.widgets);
    if (bad) return problem(422, "validation_failed", bad);
    return HttpResponse.json(
      rbRun(body.widgets, body.client_id ?? null, body.period ?? { preset: "", from: "", to: "" }),
    );
  }),
  http.post(url("/v1/report-templates/:id/share"), async ({ params, request }) => {
    const t = rb().templates.find((x) => x.id === params.id);
    if (!t) return problem(404, "not_found", "Report not found.");
    const body = (await request.json()) as { client_id: string; period?: S["AskPeriod"]; locale?: string };
    const period = body.period ?? { preset: "", from: "", to: "" };
    return HttpResponse.json(rbShare(t, body.client_id, period, body.locale || "en", null), { status: 201 });
  }),
  http.get(url("/v1/report-templates/:id/runs"), ({ params }) =>
    HttpResponse.json({
      data: rb()
        .runs.filter((r) => r.template_id === params.id)
        .map(({ view: _view, template_id: _t, ...r }) => r),
    }),
  ),
  http.get(url("/v1/report-templates/:id/schedules"), ({ params }) =>
    HttpResponse.json({ data: rb().schedules.filter((s) => s.template_id === params.id) }),
  ),
  http.post(url("/v1/report-templates/:id/schedules"), async ({ params, request }) => {
    if (!rb().templates.some((x) => x.id === params.id)) return problem(404, "not_found", "Report not found.");
    const body = (await request.json()) as {
      client_id: string;
      cadence: "weekly" | "monthly";
      send_hour: number;
      recipients: string[];
      locale: string;
    };
    const recipients = [...new Set(body.recipients.map((r) => r.trim().toLowerCase()))];
    if (!recipients.length || recipients.length > 10 || recipients.some((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)))
      return problem(422, "validation_failed", "Enter 1 to 10 email addresses.");
    const s: S["ReportSchedule"] = {
      id: `rbs-${Date.now().toString(36)}`,
      template_id: String(params.id),
      client_id: body.client_id,
      cadence: body.cadence,
      send_hour: body.send_hour,
      recipients,
      locale: body.locale,
      active: true,
      next_run_at: rbNextRun(body.cadence, body.send_hour),
      last_run_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
    };
    rb().schedules.push(s);
    saveRb();
    return HttpResponse.json(s, { status: 201 });
  }),
  http.post(url("/v1/report-schedules/:id/:action"), ({ params }) => {
    const s = rb().schedules.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Schedule not found.");
    if (params.action === "send-now") {
      const t = rb().templates.find((x) => x.id === s.template_id);
      if (!t) return problem(404, "not_found", "Report not found.");
      const preset = s.cadence === "monthly" ? "last_month" : "last_week";
      return HttpResponse.json(rbShare(t, s.client_id, { preset, from: "", to: "" }, s.locale, s.id));
    }
    s.active = params.action === "resume";
    if (s.active) Object.assign(s, { next_run_at: rbNextRun(s.cadence, s.send_hour), last_error: null });
    saveRb();
    return HttpResponse.json(s);
  }),
  http.delete(url("/v1/report-schedules/:id"), ({ params }) => {
    rb().schedules = rb().schedules.filter((x) => x.id !== params.id);
    saveRb();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/public/report-runs/:token"), ({ params }) => {
    const id = String(params.token).replace(/^mock-rb-/, "");
    const r = rb().runs.find((x) => x.id === id);
    return r ? HttpResponse.json(r.view) : problem(404, "not_found", "This report link is invalid or has expired.");
  }),
];

// sessionStorage: the TV page is a fresh load. A teammate is on the first lead.
type TtState = { coaching: boolean; screens: S["WallboardScreen"][] };
let ttState: TtState | null = null;
function tt(): TtState {
  if (ttState) return ttState;
  try {
    const raw = sessionStorage.getItem("mock-tt");
    if (raw) return (ttState = JSON.parse(raw) as TtState);
  } catch {
    // private mode: start fresh
  }
  return (ttState = { coaching: false, screens: [] });
}
function saveTt() {
  try {
    sessionStorage.setItem("mock-tt", JSON.stringify(tt()));
  } catch {
    // not persisted: fine for a demo
  }
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function ttStats(leads: typeof db.leads): S["WallboardStats"] {
  const since = db.now() - 24 * 3600_000;
  const today = leads.filter((l) => Date.parse(l.received_at) >= since);
  const answered = today.filter((l) => l.first_response_at);
  const secs = answered.map((l) => (Date.parse(l.first_response_at!) - Date.parse(l.received_at)) / 1000);
  const late = answered.filter((l) => l.sla?.status === "overdue").length;
  return {
    overdue: leads.filter((l) => l.sla?.status === "overdue").length,
    started: today.length,
    answered: answered.length,
    median_seconds: median(secs),
    on_time_rate: answered.length ? (answered.length - late) / answered.length : null,
  };
}

function coachingView(): S["CoachingView"] {
  const base = { timezone: db.clients[0]!.timezone, week_start: 6 };
  if (!tt().coaching) return { ...base, enabled: false, summary: null };
  const week = (back: number, answered: number, med: number, breached = 0): S["CoachingWeek"] => {
    const d = new Date(db.now() - back * 7 * 864e5);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
    return {
      start: `${d.toISOString().slice(0, 10)}T00:00:00Z`,
      answered,
      met: answered - breached,
      breached,
      median_seconds: med,
      on_time_rate: answered ? (answered - breached) / answered : null,
    };
  };
  const weeks = [week(3, 18, 540, 3), week(2, 22, 420, 2), week(1, 25, 300, 1), week(0, 9, 240)];
  return {
    ...base,
    enabled: true,
    summary: {
      streak: { current: 4, best: 6 },
      this_week: weeks[3]!,
      last_week: weeks[2]!,
      best: weeks[2]!,
      weeks,
      highlights: ["new_best", "streak", "faster"],
    },
  };
}

const ttHandlers = [
  http.get(url("/v1/me/coaching"), () => HttpResponse.json(coachingView())),
  http.put(url("/v1/me/coaching"), async ({ request }) => {
    const { enabled } = (await request.json()) as { enabled: boolean };
    tt().coaching = enabled;
    saveTt();
    return HttpResponse.json(coachingView());
  }),
  http.get(url("/v1/wallboards"), () => HttpResponse.json({ data: tt().screens })),
  http.post(url("/v1/wallboards"), async ({ request }) => {
    const b = (await request.json()) as S["WallboardInput"];
    if (!b.name?.trim()) return problem(422, "validation_failed", "name: 1 to 80 characters");
    const s: S["WallboardScreen"] = {
      id: `wb${Date.now().toString(36)}`,
      name: b.name.trim(),
      client_ids: b.client_ids ?? [],
      rotate_seconds: b.rotate_seconds ?? 20,
      dim_from: b.dim_from ?? null,
      dim_to: b.dim_to ?? null,
      timezone: b.timezone ?? db.clients[0]!.timezone,
      show_leaderboard: b.show_leaderboard ?? false,
      created_by: db.me.user.id,
      last_seen_at: null,
      created_at: new Date().toISOString(),
    };
    tt().screens.push(s);
    saveTt();
    return HttpResponse.json(ttPaired(s), { status: 201 });
  }),
  http.put(url("/v1/wallboards/:id"), async ({ params, request }) => {
    const s = tt().screens.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Screen not found.");
    const b = (await request.json()) as S["WallboardInput"];
    Object.assign(s, {
      name: b.name.trim(),
      client_ids: b.client_ids ?? [],
      rotate_seconds: b.rotate_seconds ?? s.rotate_seconds,
      dim_from: b.dim_from ?? null,
      dim_to: b.dim_to ?? null,
      show_leaderboard: b.show_leaderboard ?? false,
    });
    saveTt();
    return HttpResponse.json(s);
  }),
  http.post(url("/v1/wallboards/:id/token"), ({ params }) => {
    const s = tt().screens.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Screen not found.");
    s.last_seen_at = null;
    saveTt();
    return HttpResponse.json(ttPaired(s));
  }),
  http.delete(url("/v1/wallboards/:id"), ({ params }) => {
    tt().screens = tt().screens.filter((x) => x.id !== params.id);
    saveTt();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/public/wallboard"), async ({ request }) => {
    const { token } = (await request.json()) as { token: string };
    const s = tt().screens.find((x) => token === `wb_mock-${x.id}`);
    if (!s) return problem(404, "not_found", "This screen isn't paired any more.");
    s.last_seen_at = new Date().toISOString();
    saveTt();
    const shown = db.clients.filter((c) => s.client_ids.length === 0 || s.client_ids.includes(c.id)).slice(0, 12);
    const ids = new Set(shown.map((c) => c.id));
    const hour = new Date().getHours();
    const dimmed =
      s.dim_from != null && s.dim_to != null && s.dim_from !== s.dim_to
        ? s.dim_from < s.dim_to
          ? hour >= s.dim_from && hour < s.dim_to
          : hour >= s.dim_from || hour < s.dim_to
        : false;
    const board: S["WallboardBoard"] = {
      name: s.name,
      agency: db.agency.name,
      timezone: s.timezone,
      day: new Date(db.now()).toISOString().slice(0, 10),
      generated_at: new Date().toISOString(),
      dimmed,
      rotate_seconds: s.rotate_seconds,
      refresh_seconds: 15,
      totals: ttStats(db.leads.filter((l) => ids.has(l.client_id))),
      clients: shown.map((c) => ({ name: c.name, ...ttStats(db.leads.filter((l) => l.client_id === c.id)) })),
      leaderboard: s.show_leaderboard
        ? tt().coaching
          ? [
              { name: "সাদিয়া ই.", answered: 14, median_seconds: 95, on_time_rate: 1 },
              { name: "Rahim U.", answered: 11, median_seconds: 160, on_time_rate: 0.91 },
            ]
          : [{ name: "Rahim U.", answered: 11, median_seconds: 160, on_time_rate: 0.91 }]
        : null,
      brand: brandIfSet(),
    };
    return HttpResponse.json(board);
  }),
  http.post(url("/v1/presence"), async ({ request }) => {
    const { resource, state } = (await request.json()) as { resource: string; state: "viewing" | "editing" };
    const viewers: S["PresenceView"]["viewers"] = [{ user_id: db.me.user.id, name: db.me.user.name, state }];
    const mate = db.members.find((m) => m.role === "manager")!;
    viewers.push({
      user_id: mate.user.id,
      name: mate.user.name,
      state: resource === `lead:${db.leads[0]?.id}` ? "editing" : "viewing",
    });
    viewers.sort((a, b) => (a.state === b.state ? 0 : a.state === "editing" ? -1 : 1));
    return HttpResponse.json({ resource, viewers } satisfies S["PresenceView"]);
  }),
  http.post(url("/v1/presence/leave"), () => new HttpResponse(null, { status: 204 })),
];

function ttPaired(s: S["WallboardScreen"]): S["WallboardPaired"] {
  const token = `wb_mock-${s.id}`;
  const origin = typeof location === "undefined" ? "" : location.origin;
  return { screen: s, token, url: `${origin}/${db.agency.default_locale ?? "en"}/tv#k=${token}` };
}

// In memory: a reload starts over.
const MOCK_GROUP_ID = "0190f0f0-0000-7000-8000-00000000c001";
const mockGroups = {
  group: {
    id: MOCK_GROUP_ID,
    name: "Bright Holdings",
    reporting_currency: "BDT",
    home_region: "ap1",
    my_role: "owner" as const,
    created_at: "2026-09-01T09:00:00Z",
  },
  agencies: [
    { id: "0190f0f0-0000-7000-8000-00000000c101", name: "Demo Digital Agency", joined_at: "2026-09-01T09:00:00Z" },
    { id: "0190f0f0-0000-7000-8000-00000000c102", name: "Bright Skin Clinic", joined_at: "2026-09-03T09:00:00Z" },
  ],
  members: [
    {
      user_id: "0190f0f0-0000-7000-8000-00000000c201",
      name: "সাদিয়া ইসলাম",
      email: "owner@demo.recov.local",
      role: "owner" as const,
    },
  ] as S["HoldingGroupDetail"]["members"],
  invites: [] as S["HoldingGroupInvite"][],
  linked: true,
};

function mockGroupLine(
  agencyId: string | null,
  name: string,
  n: { leads: number; contacted: number; won: number; lost: number; met: number; breached: number; revenue: number },
  speed: number | null,
): S["HoldingGroupReportLine"] {
  return {
    agency_id: agencyId,
    name,
    leads_received: n.leads,
    leads_won: n.won,
    win_rate: n.won + n.lost ? n.won / (n.won + n.lost) : null,
    contact_rate: n.leads ? n.contacted / n.leads : null,
    sla_compliance: n.met + n.breached ? n.met / (n.met + n.breached) : null,
    sla_breached: n.breached,
    speed_to_lead_median_seconds: speed,
    revenue_minor: n.revenue,
    spend_minor: 0,
    missing_currencies: [],
  };
}

const groupHandlers = [
  http.get(url("/v1/groups"), () => HttpResponse.json({ data: [mockGroups.group] })),
  http.post(url("/v1/groups"), () =>
    mockGroups.linked
      ? problem(409, "agency_in_group", "This agency already belongs to a group. Leave it first.")
      : HttpResponse.json(mockGroups.group, { status: 201 }),
  ),
  http.get(url("/v1/groups/:id"), ({ params }) =>
    params.id !== MOCK_GROUP_ID
      ? problem(404, "not_found", "Group not found.")
      : HttpResponse.json({
          ...mockGroups.group,
          agencies: mockGroups.agencies,
          members: mockGroups.members,
          invites: mockGroups.invites,
        }),
  ),
  http.get(url("/v1/groups/:id/report"), ({ request }) => {
    const u = new URL(request.url);
    // Summed counts, not averaged rates: the total's rates come from the sums.
    const a = { leads: 120, contacted: 108, won: 30, lost: 50, met: 96, breached: 12, revenue: 45_000_000 };
    const b = { leads: 80, contacted: 60, won: 10, lost: 30, met: 50, breached: 20, revenue: 15_000_000 };
    const sum = Object.fromEntries(
      Object.keys(a).map((k) => [k, a[k as keyof typeof a] + b[k as keyof typeof b]]),
    ) as typeof a;
    const agencies = mockGroups.agencies.map((x, i) =>
      mockGroupLine(x.id, x.name, i === 0 ? a : b, i === 0 ? 240 : 610),
    );
    return HttpResponse.json({
      group_id: MOCK_GROUP_ID,
      from: u.searchParams.get("from"),
      to: u.searchParams.get("to"),
      currency: mockGroups.group.reporting_currency,
      agencies,
      total: mockGroupLine(null, mockGroups.group.name, agencies.length === 2 ? sum : a, null),
    });
  }),
  http.post(url("/v1/groups/:id/invites"), () => {
    const inv = { id: crypto.randomUUID(), expires_at: "2026-10-21T09:00:00Z", created_at: new Date().toISOString() };
    mockGroups.invites.push(inv);
    return HttpResponse.json({ ...inv, code: "grp_mockInviteCode123" }, { status: 201 });
  }),
  http.delete(url("/v1/groups/:id/invites/:inviteId"), ({ params }) => {
    mockGroups.invites = mockGroups.invites.filter((i) => i.id !== params.inviteId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(url("/v1/groups/:id/agencies/:agencyId"), ({ params }) => {
    mockGroups.agencies = mockGroups.agencies.filter((a) => a.id !== params.agencyId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/groups/:id/eligible-members"), () =>
    HttpResponse.json({
      data: [
        {
          user_id: "0190f0f0-0000-7000-8000-00000000c202",
          name: "Farhan Kabir",
          email: "farhan@brightskin.test",
          agencies: ["Bright Skin Clinic"],
        },
      ].filter((p) => !mockGroups.members.some((m) => m.user_id === p.user_id)),
    }),
  ),
  http.put(url("/v1/groups/:id/members/:userId"), async ({ params, request }) => {
    const { role } = (await request.json()) as { role: "owner" | "analyst" };
    const existing = mockGroups.members.find((m) => m.user_id === params.userId);
    const owners = mockGroups.members.filter((m) => m.role === "owner").length;
    if (existing?.role === "owner" && role !== "owner" && owners <= 1)
      return problem(409, "group_last_owner", "A group needs at least one owner.");
    if (existing) existing.role = role;
    else
      mockGroups.members.push({
        user_id: String(params.userId),
        name: "Farhan Kabir",
        email: "farhan@brightskin.test",
        role,
      });
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete(url("/v1/groups/:id/members/:userId"), ({ params }) => {
    const m = mockGroups.members.find((x) => x.user_id === params.userId);
    if (m?.role === "owner" && mockGroups.members.filter((x) => x.role === "owner").length <= 1)
      return problem(409, "group_last_owner", "A group needs at least one owner.");
    mockGroups.members = mockGroups.members.filter((x) => x.user_id !== params.userId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.patch(url("/v1/groups/:id"), async ({ request }) => {
    const b = (await request.json()) as { name: string; reporting_currency: string };
    Object.assign(mockGroups.group, b);
    return HttpResponse.json(mockGroups.group);
  }),
  http.delete(url("/v1/groups/:id"), () => new HttpResponse(null, { status: 204 })),
  http.get(url("/v1/agencies/current/group"), () =>
    HttpResponse.json({
      group: mockGroups.linked
        ? { group_id: MOCK_GROUP_ID, group_name: mockGroups.group.name, joined_at: "2026-09-01T09:00:00Z" }
        : null,
    }),
  ),
  // "grp_mock…" codes work; anything else is invalid.
  http.post(url("/v1/agencies/current/group"), async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    if (!code.startsWith("grp_mock"))
      return problem(400, "group_invite_invalid", "This code isn't valid or has expired.");
    mockGroups.linked = true;
    return HttpResponse.json({
      group_id: MOCK_GROUP_ID,
      group_name: mockGroups.group.name,
      joined_at: new Date().toISOString(),
    });
  }),
  http.delete(url("/v1/agencies/current/group"), () => {
    mockGroups.linked = false;
    return new HttpResponse(null, { status: 204 });
  }),
];

// An AWS ARN containing "denied" acts like a key policy that leaves us out.
const mockKeys: S["EncryptionKeys"] = {
  provider: "platform",
  key_ref: "",
  status: "ok",
  last_checked_at: null,
  last_error: null,
  data_key_version: 1,
  data_key_count: 1,
  lead_pii: "off",
  providers: ["platform", "aws_kms"],
};

const keyHandlers = [
  http.get(url("/v1/agencies/current/encryption-keys"), () => HttpResponse.json(mockKeys)),
  http.put(url("/v1/agencies/current/encryption-keys"), async ({ request }) => {
    const b = (await request.json()) as { provider: S["EncryptionKeys"]["provider"]; key_ref: string };
    if (b.provider === "aws_kms" && !/^arn:aws:kms:[a-z0-9-]+:\d{12}:(key|alias)\//.test(b.key_ref))
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "Invalid settings.",
          errors: [{ field: "key_ref", code: "invalid", message: "an AWS KMS key ARN" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    if (b.key_ref.includes("denied"))
      return problem(
        400,
        "kms_unreachable",
        "We couldn't use this key: AccessDeniedException. Check that the key is enabled and that its policy lets our role encrypt and decrypt.",
      );
    Object.assign(mockKeys, {
      provider: b.provider,
      key_ref: b.key_ref,
      status: "ok",
      last_error: null,
      last_checked_at: new Date().toISOString(),
    });
    return HttpResponse.json(mockKeys);
  }),
  http.post(url("/v1/agencies/current/encryption-keys/rotate"), () => {
    mockKeys.data_key_version += 1;
    mockKeys.data_key_count += 1;
    return HttpResponse.json(mockKeys);
  }),
  // Switches straight to the end state (no backfill).
  http.put(url("/v1/agencies/current/encryption-keys/lead-pii"), async ({ request }) => {
    const { enabled } = (await request.json()) as { enabled: boolean };
    mockKeys.lead_pii = enabled ? "encrypting" : "off";
    return HttpResponse.json(mockKeys);
  }),
  http.post(url("/v1/agencies/current/encryption-keys/check"), () => {
    mockKeys.last_checked_at = new Date().toISOString();
    return HttpResponse.json(mockKeys);
  }),
];

// URLs/buckets containing "denied" refuse test entries or fail the stream.
const mockStreams: S["AuditStream"][] = [];

const fieldProblem = (field: string, message: string) =>
  HttpResponse.json(
    {
      type: "about:blank",
      title: "validation_failed",
      status: 422,
      code: "validation_failed",
      detail: "Invalid settings.",
      errors: [{ field, code: "invalid", message }],
    },
    { status: 422, headers: { "Content-Type": "application/problem+json" } },
  );

function mockCloud(b: {
  kind: string;
  bucket?: string;
  prefix?: string;
  container_url?: string;
  access_key?: string;
  storage_secret?: string;
}) {
  if (b.kind === "gcs") {
    if (!/^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(b.bucket ?? ""))
      return { error: fieldProblem("bucket", "a bucket name") };
    if (!/^[A-Za-z0-9]{16,128}$/.test(b.access_key ?? ""))
      return { error: fieldProblem("access_key", "the HMAC access ID") };
    if ((b.storage_secret ?? "").length < 20) return { error: fieldProblem("storage_secret", "the HMAC secret") };
  }
  if (b.kind === "azure_blob") {
    if (!/^https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[a-z0-9-]{3,63}\/?$/.test(b.container_url ?? ""))
      return { error: fieldProblem("container_url", "a container URL") };
    const sas = (b.storage_secret ?? "").replace(/^\?/, "");
    if (!/(^|&)sp=/.test(sas) || !/(^|&)sig=/.test(sas))
      return { error: fieldProblem("storage_secret", "a SAS token") };
  }
  const prefix = b.prefix ? b.prefix.replace(/^\/+/, "").replace(/\/?$/, "/") : "";
  return {
    fields: {
      bucket: b.kind === "gcs" ? (b.bucket ?? "") : "",
      container_url: b.kind === "azure_blob" ? (b.container_url ?? "").replace(/\/$/, "") : "",
      access_key: b.kind === "gcs" ? (b.access_key ?? "") : "",
      has_storage_secret: true,
      prefix,
    },
  };
}

const streamHandlers = [
  http.get(url("/v1/audit-streams"), () =>
    HttpResponse.json({
      data: mockStreams,
      kinds: ["https", "s3", "gcs", "azure_blob"],
      aws_principal: "arn:aws:iam::123456789012:role/leadexpa-audit",
    } satisfies S["AuditStreamOverview"]),
  ),
  http.post(url("/v1/audit-streams"), async ({ request }) => {
    const b = (await request.json()) as {
      kind: "https" | "s3" | "gcs" | "azure_blob";
      format?: "ndjson" | "splunk_hec" | "datadog";
      name: string;
      url?: string;
      header_name?: string;
      header_value?: string;
      bucket?: string;
      region?: string;
      prefix?: string;
      actions?: string[];
      container_url?: string;
      access_key?: string;
      storage_secret?: string;
    };
    if (mockStreams.length >= 5) return problem(409, "audit_stream_limit", "This agency already has the most streams.");
    if (b.kind === "https" && !/^https:\/\/[^/\s]+/.test(b.url ?? "")) return fieldProblem("url", "an https address");
    if (b.kind === "s3" && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(b.bucket ?? ""))
      return fieldProblem("bucket", "an S3 bucket name");
    if (b.kind === "s3" && !/^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(b.region ?? ""))
      return fieldProblem("region", "an AWS region");
    const actions = [...new Set((b.actions ?? []).map((a) => a.trim()).filter(Boolean))].sort();
    const cloud = b.kind === "gcs" || b.kind === "azure_blob" ? mockCloud(b) : null;
    if (cloud?.error) return cloud.error;
    if (actions.some((a) => !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*(\.\*)?$/.test(a)))
      return fieldProblem("actions", "actions like lead.deleted, or groups like auth.*");
    const now = new Date().toISOString();
    const failing = b.kind === "s3" && (b.bucket ?? "").includes("denied");
    const stream: S["AuditStream"] = {
      id: crypto.randomUUID(),
      kind: b.kind,
      name: b.name,
      url: b.kind === "https" ? (b.url ?? "") : "",
      header_name: b.kind === "https" ? (b.header_name ?? "") : "",
      has_header_value: b.kind === "https" && !!b.header_value,
      bucket: b.kind === "s3" ? (b.bucket ?? "") : "",
      region: b.kind === "s3" ? (b.region ?? "") : "",
      prefix: b.kind === "s3" && b.prefix ? b.prefix.replace(/^\/+/, "").replace(/\/?$/, "/") : "",
      format: b.kind === "https" ? (b.format ?? "ndjson") : "ndjson",
      container_url: "",
      access_key: "",
      has_storage_secret: false,
      ...cloud?.fields,
      actions,
      status: "active",
      health: failing ? "failing" : "ok",
      pending: failing ? 3 : 0,
      oldest_pending_at: failing ? now : null,
      shipped_count: failing ? 0 : 1,
      consecutive_failures: failing ? 1 : 0,
      last_success_at: failing ? null : now,
      last_failure_at: failing ? now : null,
      last_error: failing ? "S3 refused the object: AccessDenied" : null,
      next_attempt_at: failing ? new Date(Date.now() + 60_000).toISOString() : null,
      created_at: now,
    };
    mockStreams.push(stream);
    return HttpResponse.json(
      { stream, secret: b.kind === "https" ? `aswsec_${crypto.randomUUID().replaceAll("-", "")}` : null },
      { status: 201 },
    );
  }),
  http.patch(url("/v1/audit-streams/:id"), async ({ params, request }) => {
    const s = mockStreams.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Not found.");
    const b = (await request.json()) as {
      name?: string;
      status?: "active" | "paused";
      access_key?: string;
      storage_secret?: string;
    };
    if (b.storage_secret !== undefined) {
      const cloud = mockCloud({ ...s, ...b, kind: s.kind });
      if (cloud.error) return cloud.error;
      if (b.access_key) s.access_key = b.access_key;
      s.health = "ok";
      s.last_error = null;
    }
    if (b.name) s.name = b.name;
    if (b.status) s.status = b.status;
    return HttpResponse.json(s);
  }),
  http.delete(url("/v1/audit-streams/:id"), ({ params }) => {
    const i = mockStreams.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Not found.");
    mockStreams.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/audit-streams/:id/rotate-secret"), ({ params }) => {
    const s = mockStreams.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Not found.");
    return HttpResponse.json({ stream: s, secret: `aswsec_${crypto.randomUUID().replaceAll("-", "")}` });
  }),
  http.post(url("/v1/audit-streams/:id/test"), ({ params }) => {
    const s = mockStreams.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Not found.");
    const refused = s.url.includes("denied") || s.bucket.includes("denied");
    return HttpResponse.json(refused ? { ok: false, error: "the endpoint answered 403" } : { ok: true, error: null });
  }),
];

// "Run now" finishes at once; a bucket containing "denied" fails.
const mockExports: S["WarehouseExport"][] = [];
const mockAgency = "0192a0b0-0000-7000-8000-00000000a6e1";

const exportHandlers = [
  http.get(url("/v1/warehouse-exports"), () =>
    HttpResponse.json({
      data: mockExports,
      available: true,
      kinds: ["s3", "gcs", "azure_blob"],
      aws_principal: "arn:aws:iam::123456789012:role/leadexpa-audit",
      tables: [
        "clients",
        "members",
        "sources",
        "campaigns",
        "leads",
        "lead_stage_history",
        "activities",
        "sales",
        "sla_breaches",
        "ad_spend",
        "messages",
        "calls",
        "appointments",
        "conversions",
      ],
      schema_version: 1,
    } satisfies S["WarehouseExportOverview"]),
  ),
  http.post(url("/v1/warehouse-exports"), async ({ request }) => {
    const b = (await request.json()) as {
      name: string;
      kind?: "s3" | "gcs" | "azure_blob";
      bucket?: string;
      region?: string;
      prefix?: string;
      container_url?: string;
      access_key?: string;
      storage_secret?: string;
      hour_utc?: number;
      include_contact?: boolean;
    };
    const kind = b.kind ?? "s3";
    if (mockExports.length >= 3) return problem(409, "warehouse_export_limit", "This agency already has 3 exports.");
    const cloud = kind === "s3" ? null : mockCloud({ ...b, kind });
    if (cloud?.error) return cloud.error;
    if (kind === "s3" && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(b.bucket ?? ""))
      return fieldProblem("bucket", "an S3 bucket name");
    if (kind === "s3" && !/^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(b.region ?? ""))
      return fieldProblem("region", "an AWS region");
    const prefix = b.prefix ? b.prefix.replace(/^\/+/, "").replace(/\/?$/, "/") : "";
    const root = `${prefix}recov/${mockAgency}/`;
    const location =
      kind === "gcs"
        ? `gs://${b.bucket}/${root}`
        : kind === "azure_blob"
          ? `${cloud?.fields?.container_url}/${root}`
          : `s3://${b.bucket}/${root}`;
    const hour = b.hour_utc ?? 0;
    const next = new Date();
    next.setUTCHours(hour, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
    const ex: S["WarehouseExport"] = {
      id: crypto.randomUUID(),
      name: b.name,
      kind,
      bucket: kind === "azure_blob" ? "" : (b.bucket ?? ""),
      region: kind === "s3" ? (b.region ?? "") : "",
      prefix,
      container_url: cloud?.fields?.container_url ?? "",
      access_key: cloud?.fields?.access_key ?? "",
      has_storage_secret: kind !== "s3",
      location,
      hour_utc: hour,
      include_contact: !!b.include_contact,
      status: "active",
      next_run_at: next.toISOString(),
      running: false,
      last_run: null,
      created_at: new Date().toISOString(),
    };
    mockExports.push(ex);
    return HttpResponse.json(ex, { status: 201 });
  }),
  http.patch(url("/v1/warehouse-exports/:id"), async ({ params, request }) => {
    const ex = mockExports.find((x) => x.id === params.id);
    if (!ex) return problem(404, "not_found", "Not found.");
    Object.assign(ex, (await request.json()) as Partial<S["WarehouseExport"]>);
    return HttpResponse.json(ex);
  }),
  http.post(url("/v1/warehouse-exports/:id/run"), ({ params }) => {
    const ex = mockExports.find((x) => x.id === params.id);
    if (!ex) return problem(404, "not_found", "Not found.");
    if (ex.status !== "active") return problem(409, "conflict", "Resume the export before running it.");
    const now = new Date();
    const denied = ex.bucket.includes("denied");
    ex.last_run = {
      id: crypto.randomUUID(),
      trigger: "manual",
      status: denied ? "failed" : "succeeded",
      snapshot: now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z$/, "Z"),
      tables: denied ? {} : { leads: { rows: 1240, files: 1, bytes: 2_202_009 } },
      rows: denied ? 0 : 1240,
      bytes: denied ? 0 : 2_202_009,
      error: denied ? "S3 refused the upload: AccessDenied" : null,
      started_at: now.toISOString(),
      finished_at: now.toISOString(),
    };
    return HttpResponse.json(ex, { status: 202 });
  }),
  http.get(url("/v1/warehouse-exports/:id/runs"), ({ params }) => {
    const ex = mockExports.find((x) => x.id === params.id);
    if (!ex) return problem(404, "not_found", "Not found.");
    return HttpResponse.json({ data: ex.last_run ? [ex.last_run] : [] });
  }),
  http.delete(url("/v1/warehouse-exports/:id"), ({ params }) => {
    const i = mockExports.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Not found.");
    mockExports.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// sessionStorage: switching workspaces is a full-page load.
type MockSandbox = { sandbox: { id: string; name: string; created_at: string } | null; inside: boolean };
function mockSandbox(): MockSandbox {
  const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("mock-sandbox");
  return raw ? (JSON.parse(raw) as MockSandbox) : { sandbox: null, inside: false };
}
function saveSandbox(s: MockSandbox) {
  sessionStorage.setItem("mock-sandbox", JSON.stringify(s));
}
function newSandbox(): MockSandbox["sandbox"] {
  return { id: crypto.randomUUID(), name: `${db.agency.name} (sandbox)`, created_at: new Date().toISOString() };
}
const sandboxCopies = [
  "client_workspaces",
  "lead_sources",
  "sla_policies",
  "message_templates",
  "sequences",
  "automation_rules",
  "ai_agents",
];

function withSandbox(m: S["Me"]): S["Me"] {
  const s = mockSandbox();
  if (!s.sandbox || !m.agency) return m;
  const entry = {
    id: s.sandbox.id,
    name: s.sandbox.name,
    slug: `${db.agency.slug}-sandbox`,
    role: "owner" as const,
    sandbox: true,
  };
  const agencies = [...m.agencies.filter((a) => a.id !== entry.id), entry];
  if (!s.inside) return { ...m, agencies };
  return { ...m, agencies, agency: { ...m.agency, id: s.sandbox.id, name: s.sandbox.name, sandbox_of: db.agency.id } };
}

const sandboxHandlers = [
  http.get(url("/v1/agencies/current/sandbox"), () =>
    HttpResponse.json({ sandbox: mockSandbox().sandbox, copies: sandboxCopies } satisfies S["SandboxView"]),
  ),
  http.post(url("/v1/agencies/current/sandbox"), () => {
    const s = mockSandbox();
    if (s.inside) return problem(409, "sandbox_unsupported", "This isn't available in a sandbox.");
    if (s.sandbox) return problem(409, "sandbox_exists", "This agency already has a sandbox.");
    saveSandbox({ sandbox: newSandbox(), inside: false });
    return HttpResponse.json({ sandbox: mockSandbox().sandbox, copies: sandboxCopies }, { status: 201 });
  }),
  http.post(url("/v1/agencies/current/sandbox/reset"), () => {
    if (!mockSandbox().sandbox) return problem(404, "not_found", "This agency has no sandbox.");
    saveSandbox({ sandbox: newSandbox(), inside: false });
    return HttpResponse.json({ sandbox: mockSandbox().sandbox, copies: sandboxCopies });
  }),
  http.delete(url("/v1/agencies/current/sandbox"), () => {
    if (!mockSandbox().sandbox) return problem(404, "not_found", "This agency has no sandbox.");
    saveSandbox({ sandbox: null, inside: false });
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/session/agency"), async ({ request }) => {
    const { agency_id } = (await request.json()) as { agency_id: string };
    const s = mockSandbox();
    if (agency_id !== db.agency.id && agency_id !== s.sandbox?.id) return problem(403, "forbidden", "Not a member.");
    saveSandbox({ ...s, inside: agency_id === s.sandbox?.id });
    return HttpResponse.json(currentMe());
  }),
  http.post(url("/v1/sandbox/leads"), async ({ request }) => {
    if (!mockSandbox().inside) return problem(409, "not_a_sandbox", "Test leads only work in a sandbox.");
    const { count } = (await request.json()) as { count: number };
    return HttpResponse.json({ created: Array.from({ length: count }, () => crypto.randomUUID()) }, { status: 201 });
  }),
  http.post(url("/v1/sandbox/leads/:leadId/reply"), () => {
    if (!mockSandbox().inside) return problem(409, "not_a_sandbox", "Simulated replies only work in a sandbox.");
    return new HttpResponse(null, { status: 202 });
  }),
];

// This region is healthy (no banner); last month missed the target slightly.
function mockDays(seedDown: number) {
  const today = new Date();
  return Array.from({ length: 90 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (89 - i)));
    const down = i === seedDown;
    return { date: d.toISOString().slice(0, 10), uptime: down ? 99.31 : 100, state: down ? "down" : "operational" };
  });
}
function mockComponents(region: string) {
  return (["app", "lead_capture", "automations", "messaging"] as const).map((key, n) => ({
    key,
    state: (region === "eu1" && key === "lead_capture" ? "degraded" : "operational") as "degraded" | "operational",
    detail: "",
    uptime_90d: n === 0 ? 99.992 : 100,
    days: mockDays(n === 0 ? 60 : -1),
  }));
}
function mockIncident(over: Record<string, unknown>) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    kind: "incident",
    impact: "minor",
    status: "investigating",
    regions: ["eu1"],
    components: ["lead_capture"],
    started_at: new Date(now - 20 * 60_000).toISOString(),
    resolved_at: null,
    scheduled_for: null,
    scheduled_until: null,
    ...over,
  };
}
const statusHandlers = [
  http.get(url("/v1/status"), () => {
    const now = Date.now();
    return HttpResponse.json({
      generated_at: new Date(now).toISOString(),
      state: "degraded",
      regions: [
        {
          region: "ap1",
          up: true,
          state: "operational",
          maintenance: false,
          uptime_90d: 99.992,
          components: mockComponents("ap1"),
        },
        {
          region: "eu1",
          up: true,
          state: "degraded",
          maintenance: false,
          uptime_90d: 99.97,
          components: mockComponents("eu1"),
        },
      ],
      active: [
        mockIncident({
          automatic: true,
          title: {
            en: "Problems with lead capture",
            bn: "লিড সংগ্রহ-এ সমস্যা",
            ar: "مشكلات في استقبال العملاء المحتملين",
          },
          updates: [
            {
              status: "investigating",
              body: { en: "We're investigating problems with lead capture in eu1." },
              created_at: new Date(now - 20 * 60_000).toISOString(),
            },
          ],
        }),
      ],
      upcoming: [
        mockIncident({
          kind: "maintenance",
          impact: "none",
          status: "scheduled",
          regions: ["ap1"],
          components: ["messaging"],
          title: { en: "Scheduled maintenance: messaging" },
          scheduled_for: new Date(now + 2 * 86_400_000).toISOString(),
          scheduled_until: new Date(now + 2 * 86_400_000 + 3_600_000).toISOString(),
          started_at: new Date(now + 2 * 86_400_000).toISOString(),
          updates: [
            {
              status: "scheduled",
              body: { en: "We'll carry out maintenance on messaging in ap1." },
              created_at: new Date(now).toISOString(),
            },
          ],
        }),
      ],
      history: [
        mockIncident({
          status: "resolved",
          regions: ["ap1"],
          components: ["app"],
          title: { en: "Problems with the app and API" },
          resolved_at: new Date(now - 3 * 86_400_000).toISOString(),
          updates: [
            {
              status: "resolved",
              body: { en: "The app and API in ap1 are working normally again." },
              created_at: new Date(now - 3 * 86_400_000).toISOString(),
            },
          ],
        }),
      ],
      components: ["app", "lead_capture", "automations", "messaging"],
      sla_targets: { standard: 99.9, enterprise: 99.95 },
    });
  }),
  http.get(url("/v1/service-status"), () =>
    HttpResponse.json({
      available: true,
      region: "ap1",
      state: "operational",
      maintenance: false,
      uptime_90d: 99.992,
      components: mockComponents("ap1").map(({ key, state, detail, uptime_90d }) => ({
        key,
        state,
        detail,
        uptime_90d,
      })),
      active: [],
      upcoming: [],
    } satisfies S["ServiceStatus"]),
  ),
  http.get(url("/v1/agencies/current/sla"), ({ request }) => {
    const month = new URL(request.url).searchParams.get("month") ?? "";
    const current = new Date().toISOString().slice(0, 7);
    const missed = month !== current;
    return HttpResponse.json({
      region: "ap1",
      month,
      partial: month === current,
      tier: "standard",
      target: 99.9,
      availability: missed ? 99.85 : 99.996,
      met: !missed,
      credit_percent: missed ? 10 : 0,
      measured_minutes: 43200,
      down_minutes: missed ? 65 : 2,
      excluded_minutes: missed ? 60 : 0,
    } satisfies S["AgencySLA"]);
  }),
];

export const handlers = [
  ...keyHandlers,
  ...statusHandlers,
  ...sandboxHandlers,
  ...streamHandlers,
  ...exportHandlers,
  ...groupHandlers,
  ...rbHandlers,
  ...ttHandlers,
  ...appointmentHandlers,
  ...askHandlers,
  ...revintelHandlers,
  ...auditHandlers,
  ...brandHandlers,
  ...securityHandlers,
  http.get(url("/v1/me"), () => HttpResponse.json(currentMe())),
  http.post(url("/v1/auth/login"), async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    if (email.includes("+gate")) {
      Object.assign(db.security, {
        totp_enabled: false,
        passkeys: [],
        recovery_codes_remaining: 0,
        session_verified: false,
      });
      db.agency.require_admin_mfa = true;
    }
    if (email.toLowerCase().endsWith("@sso.test"))
      return problem(403, "sso_required", "Your organization signs in with single sign-on.");
    // "+offsite" signs in from outside the agency's networks (G7b): the app shows the blocked gate.
    mockAccess.blocked = email.includes("+offsite");
    if (email.startsWith("mfa@")) {
      Object.assign(db.security, { totp_enabled: true, recovery_codes_remaining: 10, session_verified: false });
      return HttpResponse.json(
        {
          mfa_required: true,
          mfa_token: MFA_TOKEN,
          methods: ["totp", "recovery_code"],
          expires_at: db.iso(db.now() + 300_000),
        },
        { status: 202 },
      );
    }
    return HttpResponse.json(currentMe());
  }),
  http.post(url("/v1/auth/signup"), () => HttpResponse.json(db.me, { status: 201 })),
  http.post(url("/v1/auth/logout"), () => new HttpResponse(null, { status: 204 })),
  http.post(url("/v1/auth/refresh"), () => new HttpResponse(null, { status: 204 })),
  http.patch(url("/v1/me"), async ({ request }) => {
    const { login_alerts, ...b } = (await request.json()) as S["MePatch"];
    Object.assign(db.me.user, b);
    if (login_alerts !== undefined) db.security.login_alerts = login_alerts;
    return HttpResponse.json(currentMe());
  }),
  http.get(url("/v1/holidays"), ({ request }) => {
    const u = new URL(request.url);
    const country = (u.searchParams.get("country") ?? "").toUpperCase();
    const year = Number(u.searchParams.get("year") ?? new Date().getFullYear());
    const presets: Record<string, [string, string][]> = {
      US: [
        ["01-01", "New Year's Day"],
        ["07-03", "Independence Day"],
        ["12-25", "Christmas Day"],
      ],
      GB: [
        ["01-01", "New Year's Day"],
        ["12-25", "Christmas Day"],
        ["12-28", "Boxing Day"],
      ],
    };
    const days = presets[country];
    return HttpResponse.json({
      country,
      year,
      supported: !!days,
      dataset: "mock",
      holidays: (days ?? []).map(([d, name]) => ({ date: `${year}-${d}`, name })),
    } satisfies S["HolidayPresets"]);
  }),
  http.post(url("/v1/me/availability"), async ({ request }) => {
    const b = (await request.json()) as { availability: "available" | "away" };
    db.me.availability = b.availability;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/agencies/current"), () => HttpResponse.json(db.agency)),
  http.patch(url("/v1/agencies/current"), async ({ request }) => {
    const b = (await request.json()) as S["AgencyPatch"];
    if (b.require_admin_mfa && !db.security.session_verified)
      return problem(409, "mfa_not_enrolled", "Turn on two-step sign-in for your own account first.");
    Object.assign(db.agency, b);
    return HttpResponse.json(db.agency);
  }),
  http.get(url("/v1/members"), () => HttpResponse.json(list(db.members))),
  http.get(url("/v1/invites"), () => HttpResponse.json(list([]))),
  http.post(url("/v1/invites"), async ({ request }) => {
    const b = (await request.json()) as { email?: string; phone?: string; role: S["Role"]; client_id?: string };
    return HttpResponse.json(
      {
        id: db.newId(),
        email: b.email ?? null,
        phone: b.phone ? `+880${b.phone.replace(/\D/g, "").replace(/^0/, "")}` : null,
        role: b.role,
        client_id: b.client_id ?? null,
        invited_by: db.me.user.id,
        expires_at: db.iso(db.now() + 7 * 86400_000),
        created_at: db.iso(db.now()),
        accept_url: `${location.origin}/bn/invite/demo-token`,
      },
      { status: 201 },
    );
  }),
  http.get(url("/v1/audit-logs"), () => HttpResponse.json(list([]))),

  http.get(url("/v1/clients"), () => HttpResponse.json(list(db.clients))),
  http.post(url("/v1/clients"), async ({ request }) => {
    const b = (await request.json()) as S["ClientCreate"];
    const c: S["Client"] = {
      id: db.newId(),
      name: b.name,
      industry: b.industry ?? "other",
      country: b.country ?? db.agency.country,
      timezone:
        b.timezone ?? ((b.country ?? db.agency.country) === db.agency.country ? db.agency.default_timezone : "UTC"),
      currency:
        b.currency ?? ((b.country ?? db.agency.country) === db.agency.country ? db.agency.default_currency : "USD"),
      assignment_strategy: b.assignment_strategy,
      fixed_owner_user_id: null,
      dedup_window_days: b.dedup_window_days,
      manual_responded_sub_types: ["walk_in"],
      routing_max_open: null,
      routing_use_skills: true,
      routing_hot_to_fastest: true,
      status: "active",
      archived_at: null,
      created_at: db.iso(db.now()),
    };
    db.clients.push(c);
    return HttpResponse.json(c, { status: 201 });
  }),
  http.get(url("/v1/clients/:id"), ({ params }) => {
    const c = db.clients.find((x) => x.id === params.id);
    return c ? HttpResponse.json(c) : problem(404, "not_found", "Client not found.");
  }),
  http.patch(url("/v1/clients/:id"), async ({ params, request }) => {
    const c = db.clients.find((x) => x.id === params.id);
    if (!c) return problem(404, "not_found", "Client not found.");
    Object.assign(c, await request.json());
    return HttpResponse.json(c);
  }),
  http.get(url("/v1/clients/:id/assignments"), () =>
    HttpResponse.json(
      list(
        db.members
          .filter((m) => m.role !== "owner")
          .map((m) => ({
            user_id: m.user.id,
            role: m.role,
            member_active: true,
            available: true,
            in_round_robin: m.role === "agent",
            receives_escalations: m.role === "manager",
            routing_weight: 1,
            max_open: null,
          })),
      ),
    ),
  ),
  http.get(url("/v1/clients/:id/sources"), ({ params }) =>
    HttpResponse.json(list(db.sources.filter((s) => s.client_id === params.id))),
  ),
  http.get(url("/v1/clients/:id/sla-policy"), ({ params }) => HttpResponse.json(db.slaPolicies.get(String(params.id)))),
  http.put(url("/v1/clients/:id/sla-policy"), async ({ params, request }) => {
    const p = { ...((await request.json()) as S["SLAPolicyInput"]), follow_up_rules: {}, is_default: false };
    db.slaPolicies.set(String(params.id), p as S["SLAPolicy"]);
    return HttpResponse.json(p);
  }),
  http.post(url("/v1/clients/:id/sla-policy/preview"), async ({ request }) => {
    const b = (await request.json()) as { received_at: string; policy?: S["SLAPolicyInput"] };
    const minutes = b.policy?.first_response_minutes ?? 15;
    const received = Date.parse(b.received_at);
    // Thursday 18:55 with business hours (Sat–Thu 10–19): 5 minutes Thursday, the rest from Saturday 10:00.
    const due = b.policy?.business_hours_only
      ? received + (2 * 24 * 60 + 15 * 60 + 5 + Math.max(0, minutes - 5)) * 60_000 - 14 * 60 * 60_000
      : received + minutes * 60_000;
    return HttpResponse.json({
      received_at: b.received_at,
      warn_at: db.iso(due - 60_000),
      due_at: db.iso(due),
      business_hours_only: !!b.policy?.business_hours_only,
      timezone: "Asia/Dhaka",
      open_at_received: true,
    });
  }),
  http.get(url("/v1/clients/:id/calendar"), () =>
    HttpResponse.json({
      timezone: "Asia/Dhaka",
      weekly_hours: {
        sat: [["10:00", "19:00"]],
        sun: [["10:00", "19:00"]],
        mon: [["10:00", "19:00"]],
        tue: [["10:00", "19:00"]],
        wed: [["10:00", "19:00"]],
        thu: [["10:00", "19:00"]],
        fri: [],
      },
      holidays: ["2026-12-16"],
      is_default: false,
      holiday_source: null,
    }),
  ),
  http.get(url("/v1/clients/:id/campaigns"), () =>
    HttpResponse.json(
      list([
        {
          id: db.newId(),
          name: "Eid Implant Offer",
          platform: "meta",
          external_key: "1",
          created_at: db.iso(db.now()),
        },
      ]),
    ),
  ),
  http.get(url("/v1/clients/:id/ai-profile"), () =>
    HttpResponse.json({
      business_description: "ঢাকার ধানমন্ডিতে আধুনিক ডেন্টাল ক্লিনিক।",
      offer: "ঈদ উপলক্ষে ইমপ্লান্টে ২০% ছাড়",
      tone: "friendly",
      faqs: [{ q: "খরচ কত?", a: "ইমপ্লান্ট ৳৪৫,০০০ থেকে শুরু।" }],
      updated_at: db.iso(db.now()),
    }),
  ),
  http.get(url("/v1/clients/:id/reports"), ({ params }) =>
    HttpResponse.json(list(db.reports.filter((r) => r.client_id === params.id).map(({ snapshot: _s, ...r }) => r))),
  ),
  http.post(url("/v1/clients/:id/reports"), async ({ params, request }) => {
    const b = (await request.json()) as {
      from: string;
      to: string;
      locale?: "bn" | "en";
      title?: string;
      narrative?: string;
    };
    const client = db.clients.find((c) => c.id === params.id)!;
    const d = dashboard(new URL(url(`/v1/dashboard?from=${b.from}&to=${b.to}&client_id=${client.id}`)));
    const r: S["Report"] = {
      id: db.newId(),
      client_id: client.id,
      period_from: b.from,
      period_to: b.to,
      version: 1,
      title: b.title || `${client.name} · ${b.from} – ${b.to}`,
      locale: b.locale ?? "bn",
      include_leads: false,
      definition_version: d.definition_version,
      pdf_status: "pending",
      pdf_error: null,
      pdf_generated_at: null,
      created_by: db.me.user.id,
      created_at: db.iso(db.now()),
      snapshot: {
        generated_at: db.iso(db.now()),
        agency: { name: db.agency.name },
        client: { id: client.id, name: client.name, timezone: client.timezone, currency: client.currency },
        period: d.period,
        previous_period: d.previous_period,
        kpis: d.kpis,
        previous_kpis: d.previous_kpis,
        by_day: d.by_day,
        by_campaign: d.by_campaign,
        narrative: b.narrative ?? null,
        leads: null,
        leads_truncated: false,
        definition_version: d.definition_version,
        definitions: d.definitions,
      },
    };
    db.reports.unshift(r);
    setTimeout(() => (r.pdf_status = "ready"), 4000);
    return HttpResponse.json(r, { status: 201 });
  }),
  http.get(url("/v1/reports/:id"), ({ params }) => {
    const r = db.reports.find((x) => x.id === params.id);
    return r ? HttpResponse.json(r) : problem(404, "not_found", "Report not found.");
  }),
  http.get(url("/v1/reports/:id/shares"), ({ params }) =>
    HttpResponse.json(list(db.shares.get(String(params.id)) ?? [])),
  ),
  http.post(url("/v1/reports/:id/shares"), ({ params }) => {
    const token = `demo-${db.newId()}`;
    const s: S["ReportShare"] = {
      id: db.newId(),
      report_id: String(params.id),
      expires_at: null,
      revoked_at: null,
      view_count: 0,
      last_viewed_at: null,
      active: true,
      created_by: db.me.user.id,
      created_at: db.iso(db.now()),
    };
    db.shares.set(String(params.id), [s, ...(db.shares.get(String(params.id)) ?? [])]);
    return HttpResponse.json({ ...s, token, url: `${location.origin}/bn/r/${token}` }, { status: 201 });
  }),

  http.get(url("/v1/inbox"), async ({ request }) => {
    await delay(150);
    const mine = db.leads
      .filter((l) => l.stage !== "won" && l.stage !== "lost" && l.quality.status !== "junk")
      .map((l) => ({ ...stripDetail(l), section: db.inboxSection(l) }));
    const order = ["overdue", "due_soon", "callback_due", "new", "unassigned", "in_progress"];
    const byScore = new URL(request.url).searchParams.get("sort") === "score";
    mine.sort(
      (a, b) =>
        order.indexOf(a.section) - order.indexOf(b.section) ||
        (byScore ? (b.score?.value ?? 0) - (a.score?.value ?? 0) : 0) ||
        (a.sla?.due_at ?? "").localeCompare(b.sla?.due_at ?? ""),
    );
    const page = paginate(mine, new URL(request.url));
    return HttpResponse.json({
      ...page,
      counts: Object.fromEntries(order.map((s) => [s, mine.filter((l) => l.section === s).length])),
    });
  }),
  http.get(url("/v1/leads/:id/contact-policy"), ({ params }) => {
    const l = db.leads.find((x) => x.id === params.id);
    const decision = (verdict: "allow" | "deny", reasons: string[]): S["ContactDecision"] => ({
      verdict,
      reasons,
      defer_until: null,
      disclosures: [],
      registration: null,
      policy_version: "cp1",
      policy_source: "default",
      jurisdiction: l?.phone_country ?? "BD",
    });
    const d = l?.do_not_contact ? decision("deny", ["opted_out"]) : decision("allow", []);
    return HttpResponse.json({
      jurisdiction: l?.phone_country ?? "BD",
      policy_version: "cp1",
      purpose: "follow_up_on_enquiry",
      channels: { call: d, whatsapp: d, sms: d, email: d },
    });
  }),
  http.get(url("/v1/leads/:id/consents"), ({ params }) => HttpResponse.json(consentView(String(params.id)))),
  http.post(url("/v1/leads/:id/consents"), async ({ params, request }) => {
    const b = (await request.json()) as {
      channel: string;
      scope: "contact" | "marketing";
      granted: boolean;
      note?: string;
    };
    const id = String(params.id);
    const list = db.consentEvents.get(id) ?? [];
    list.push({
      id: db.newId(),
      channel: b.channel,
      scope: b.scope,
      granted: b.granted,
      source: "agent",
      written: false,
      evidence: { note: b.note ?? "" },
      actor_user_id: db.me.user.id,
      captured_at: db.iso(db.now()),
    });
    db.consentEvents.set(id, list);
    const lead = db.leads.find((x) => x.id === id);
    if (lead && b.channel === "any" && b.scope === "contact") lead.do_not_contact = !b.granted;
    return HttpResponse.json(consentView(id), { status: 201 });
  }),
  http.get(url("/v1/leads/quality-counts"), ({ request }) => {
    const client = new URL(request.url).searchParams.get("client_id");
    const rows = db.leads.filter((l) => !client || l.client_id === client);
    return HttpResponse.json({
      suspect: rows.filter((l) => l.quality.status === "suspect").length,
      junk: rows.filter((l) => l.quality.status === "junk").length,
    });
  }),
  http.post(url("/v1/leads/quality"), async ({ request }) => {
    const b = (await request.json()) as { lead_ids: string[]; status: "valid" | "suspect" | "junk" };
    const changed = db.leads.filter((l) => b.lead_ids.includes(l.id));
    for (const l of changed) {
      l.quality = { ...l.quality, status: b.status, source: "agent", labeled_at: db.iso(db.now()) };
      if (b.status === "junk") l.sla = null;
      l.version += 1;
    }
    return HttpResponse.json({ data: changed.map(stripDetail) });
  }),
  http.get(url("/v1/leads"), ({ request }) => {
    const u = new URL(request.url);
    return HttpResponse.json(paginate(filterLeads(u).map(stripDetail), u));
  }),
  http.post(url("/v1/leads"), async ({ request }) => {
    const b = (await request.json()) as { client_id: string; full_name?: string; phone?: string };
    const base = db.leads[0]!;
    const digits = (b.phone ?? "").replace(/\D/g, "");
    const l: S["LeadDetail"] = {
      ...base,
      id: db.newId(),
      client_id: b.client_id,
      full_name: b.full_name ?? "",
      // Like the API: an international number stays as given; a local one is read in the (BD) demo client's country.
      phone: (b.phone ?? "").trim().startsWith("+")
        ? { e164: `+${digits}`, display: `+${digits}` }
        : { e164: `+88${digits}`, display: `${digits.slice(0, 5)}-${digits.slice(5)}` },
      stage: "new",
      owner_user_id: db.me.user.id,
      received_at: db.iso(db.now()),
      first_attempt_at: null,
      first_response_at: null,
      last_activity_at: null,
      next_callback_at: null,
      sla: { status: "on_track", due_at: db.iso(db.now() + 15 * 60_000), kind: "first_response" },
      quality: {
        status: "valid",
        score: 100,
        reasons: [],
        source: "rules",
        rules_version: "q1",
        verified_at: null,
        labeled_at: null,
      },
      phone_country: (b.phone ?? "").trim().startsWith("+") ? null : "BD",
      do_not_contact: false,
      version: 1,
      duplicate_count: 0,
      campaign: null,
    };
    db.leads.unshift(l);
    db.activities.set(l.id, []);
    return HttpResponse.json(l, { status: 201 });
  }),
  http.get(url("/v1/leads/:id"), ({ params }) => {
    const l = findLead(String(params.id));
    return l ? HttpResponse.json(l) : problem(404, "not_found", "Lead not found.");
  }),
  http.post(url("/v1/leads/:id/action-link"), ({ params }) => {
    const l = findLead(String(params.id));
    if (!l) return problem(404, "not_found", "Lead not found.");
    if (!l.owner_user_id) return problem(400, "action_link_no_owner", "Assign the lead first.");
    const token = `mock-${l.id}`;
    const created: S["ActionLinkCreated"] = {
      token,
      path: `/t/${token}`,
      expires_at: db.iso(db.now() + 72 * 3600_000),
      for_user_id: l.owner_user_id,
    };
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(url("/v1/public/action-links/:token"), ({ params }) => {
    const v = actionLinkView(String(params.token));
    return v instanceof Response ? v : HttpResponse.json(v);
  }),
  http.post(url("/v1/public/action-links/:token/activities"), async ({ params, request }) => {
    await delay(150);
    const token = String(params.token);
    const before = actionLinkView(token);
    if (before instanceof Response) return before;
    const l = findLead(before.lead_id)!;
    const b = (await request.json()) as { type: "call" | "whatsapp"; outcome: string };
    const at = db.iso(db.now());
    const responds = b.outcome !== "no_answer" && b.outcome !== "busy";
    db.activities.set(l.id, [
      ...(db.activities.get(l.id) ?? []),
      {
        id: db.newId(),
        lead_id: l.id,
        actor_user_id: l.owner_user_id,
        type: b.type,
        channel: b.type === "call" ? "phone" : b.type,
        direction: "outbound",
        outcome: b.outcome,
        body: "",
        meta: { via: "action_link" },
        counts_as_attempt: true,
        counts_as_response: responds,
        occurred_at: at,
        created_at: at,
      },
    ]);
    Object.assign(l, {
      last_activity_at: at,
      first_attempt_at: l.first_attempt_at ?? at,
      first_response_at: l.first_response_at ?? (responds ? at : null),
      stage: l.stage === "new" ? "contacted" : l.stage,
      sla: responds && l.sla ? { status: "met", due_at: null, kind: l.sla.kind } : l.sla,
      version: l.version + 1,
    });
    return HttpResponse.json(actionLinkView(token) as S["ActionLinkView"], { status: 201 });
  }),
  http.get(url("/v1/leads/:id/activities"), ({ params }) =>
    HttpResponse.json(list([...(db.activities.get(String(params.id)) ?? [])].reverse())),
  ),
  http.post(url("/v1/leads/:id/activities"), async ({ params, request }) => {
    await delay(200);
    const l = findLead(String(params.id));
    if (!l) return problem(404, "not_found", "Lead not found.");
    const b = (await request.json()) as S["ActivityCreate"];
    const at = db.iso(db.now());
    const responds = b.type !== "note" && b.outcome !== "no_answer" && b.outcome !== "busy";
    const a: S["Activity"] = {
      id: db.newId(),
      lead_id: l.id,
      actor_user_id: db.me.user.id,
      type: b.type,
      channel: b.type === "call" ? "phone" : b.type,
      direction: "outbound",
      outcome: b.outcome ?? null,
      body: b.body ?? "",
      meta: {},
      counts_as_attempt: b.type !== "note",
      counts_as_response: responds,
      occurred_at: at,
      created_at: at,
    };
    db.activities.set(l.id, [...(db.activities.get(l.id) ?? []), a]);
    Object.assign(l, {
      last_activity_at: at,
      first_attempt_at: l.first_attempt_at ?? (b.type !== "note" ? at : null),
      first_response_at: l.first_response_at ?? (responds ? at : null),
      stage: l.stage === "new" && b.type !== "note" ? "contacted" : l.stage,
      next_callback_at: b.outcome === "callback_requested" ? b.callback_at : l.next_callback_at,
      sla: responds && l.sla ? { status: "met", due_at: null, kind: l.sla.kind } : l.sla,
      version: l.version + 1,
    });
    return HttpResponse.json({ activity: a, lead: stripDetail(l) }, { status: 201 });
  }),
  http.post(url("/v1/leads/:id/stage"), async ({ params, request }) => {
    const l = findLead(String(params.id));
    if (!l) return problem(404, "not_found", "Lead not found.");
    const b = (await request.json()) as {
      version: number;
      to: S["Stage"];
      lost_reason?: string;
      sale?: S["SaleInput"];
    };
    if (b.version !== l.version) return problem(409, "version_conflict", "Stale version.");
    l.stage = b.to;
    l.version += 1;
    l.stage_changed_at = db.iso(db.now());
    if (b.to === "won") {
      l.won_at = l.stage_changed_at;
      if (b.sale) {
        l.deal_value = { amount_minor: b.sale.amount_minor, currency: "BDT" };
        db.sales.set(l.id, [
          {
            id: db.newId(),
            lead_id: l.id,
            client_id: l.client_id,
            amount: l.deal_value,
            sold_at: l.won_at,
            source: "manual",
            external_ref: null,
            note: "",
            campaign_id: null,
            owner_user_id: l.owner_user_id,
            recorded_by: db.me.user.id,
            voided_at: null,
            created_at: l.won_at,
          },
        ]);
      }
    }
    if (b.to === "lost") l.lost_reason = b.lost_reason ?? "other";
    if (b.to === "won" || b.to === "lost") l.sla = null;
    return HttpResponse.json(stripDetail(l));
  }),
  http.post(url("/v1/leads/:id/assign"), async ({ params, request }) => {
    const l = findLead(String(params.id));
    if (!l) return problem(404, "not_found", "Lead not found.");
    const b = (await request.json()) as { version: number; owner_user_id: string | null };
    l.owner_user_id = b.owner_user_id;
    l.version += 1;
    return HttpResponse.json(stripDetail(l));
  }),
  http.get(url("/v1/leads/:id/sla"), ({ params }) => {
    const l = findLead(String(params.id));
    if (!l?.sla) return HttpResponse.json(list([]));
    return HttpResponse.json(
      list([
        {
          id: db.newId(),
          kind: "first_response",
          status: l.sla.status === "met" ? "met" : l.sla.status === "overdue" ? "breached" : "pending",
          started_at: l.received_at,
          warn_at: l.received_at,
          due_at: l.sla.due_at ?? l.received_at,
          business_hours: true,
          met_at: l.first_response_at,
          breached_at: null,
          resolved_at: null,
          response_seconds: l.first_response_at
            ? (Date.parse(l.first_response_at) - Date.parse(l.received_at)) / 1000
            : null,
          escalation_level: l.sla.status === "overdue" ? 1 : 0,
          next_escalation_at: null,
          meta: {},
        },
      ]),
    );
  }),
  http.get(url("/v1/leads/:id/sales"), ({ params }) => HttpResponse.json(list(db.sales.get(String(params.id)) ?? []))),
  http.post(url("/v1/leads/:id/sales"), async ({ params, request }) => {
    const l = findLead(String(params.id))!;
    const b = (await request.json()) as S["SaleInput"];
    const s: S["Sale"] = {
      id: db.newId(),
      lead_id: l.id,
      client_id: l.client_id,
      amount: { amount_minor: b.amount_minor, currency: "BDT" },
      sold_at: db.iso(db.now()),
      source: "manual",
      external_ref: null,
      note: b.note ?? "",
      campaign_id: null,
      owner_user_id: l.owner_user_id,
      recorded_by: db.me.user.id,
      voided_at: null,
      created_at: db.iso(db.now()),
    };
    db.sales.set(l.id, [s, ...(db.sales.get(l.id) ?? [])]);
    return HttpResponse.json(s, { status: 201 });
  }),
  http.get(url("/v1/leads/:id/assistant/next-action"), ({ params }) => {
    const l = findLead(String(params.id));
    const action = !l?.first_response_at
      ? "first_contact"
      : l.next_callback_at
        ? "call_back"
        : l.stage === "contacted"
          ? "qualify"
          : "follow_up";
    return HttpResponse.json({
      action,
      reason_code: action,
      reason: "নতুন লিড, প্রথম ৫ মিনিটে কল করলে বিক্রির সম্ভাবনা সবচেয়ে বেশি।",
      due_at: l?.sla?.due_at ?? null,
    });
  }),
  http.post(url("/v1/leads/:id/assistant/draft"), async ({ params, request }) => {
    await delay(900);
    const l = findLead(String(params.id));
    const b = (await request.json()) as { language: string };
    const n = l?.full_name ?? "";
    const variants =
      b.language === "en"
        ? [
            `Hi ${n}, thanks for your interest in our Eid implant offer! Would today 5 PM work for a quick call?`,
            `Hello ${n}, this is Dhaka Dental Care. When can we call you about your enquiry?`,
          ]
        : [
            `আসসালামু আলাইকুম ${n}, ঈদ অফারে আগ্রহ দেখানোর জন্য ধন্যবাদ! আজ বিকেল ৫টায় একটু কথা বলা যাবে?`,
            `হ্যালো ${n}, ঢাকা ডেন্টাল কেয়ার থেকে বলছি। আপনার জিজ্ঞাসা নিয়ে কখন কল করব?`,
          ];
    return HttpResponse.json({
      generation_id: db.newId(),
      variants: variants.map((text) => ({ text })),
      model: "mock",
      prompt_version: "draft/v1",
      latency_ms: 900,
    });
  }),
  http.post(url("/v1/leads/:id/assistant/summary"), async () => {
    await delay(700);
    return HttpResponse.json({
      generation_id: db.newId(),
      summary: "ইমপ্লান্টে আগ্রহী, এই মাসেই করাতে চান।",
      intent: "interested",
      budget: "৳৫০,০০০ পর্যন্ত",
      timeline: "এই মাসে",
      objections: ["দাম"],
      next_step: "শুক্রবার চেকআপ বুক করা",
      suggested_stage: "qualified",
      model: "mock",
      prompt_version: "summary/v1",
    });
  }),
  http.post(url("/v1/assistant/generations/:id/feedback"), () => new HttpResponse(null, { status: 204 })),
  http.get(url("/v1/assistant/usage"), () =>
    HttpResponse.json({
      period: "2026-10",
      generations: 42,
      generation_quota: 300,
      tokens: 50_000,
      cost_micros: 1_200_000,
    }),
  ),

  http.get(url("/v1/notifications"), () =>
    HttpResponse.json({
      data: db.notifications,
      unread_count: db.notifications.filter((n) => !n.read_at).length,
      next_cursor: null,
    }),
  ),
  http.post(url("/v1/notifications/read-all"), () => {
    db.notifications.forEach((n) => (n.read_at = db.iso(db.now())));
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/notifications/:id/read"), ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id);
    if (n) n.read_at = db.iso(db.now());
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/notification-preferences"), () =>
    HttpResponse.json({
      events: [
        "lead.assigned",
        "sla.warning",
        "sla.breached",
        "sla.escalated",
        "digest.daily",
        "integration.health",
        "integration.token_expiring",
        "automation.alert",
        "payment.received",
        "billing.payment_failed",
        "billing.budget",
        "client.anomaly",
        "client.health",
        "agent.handoff",
      ].map((event_type) => ({
        event_type,
        in_app: event_type !== "digest.daily",
        email: event_type !== "lead.assigned" && event_type !== "sla.warning",
      })),
      quiet_start: null,
      quiet_end: null,
      digest_hour: 9,
    }),
  ),
  http.put(url("/v1/notification-preferences"), async ({ request }) => HttpResponse.json(await request.json())),

  http.get(url("/v1/dashboard"), async ({ request }) => {
    await delay(200);
    return HttpResponse.json(dashboard(new URL(request.url)));
  }),
  http.post(url("/v1/dashboard/refresh"), () => HttpResponse.json({ clients_refreshed: db.clients.length })),
  http.get(url("/v1/billing"), () => {
    const sub = mockBilling().subscription;
    if (sub && sub.status !== "canceled") {
      const plan = sub.plan ?? "growth";
      const names: Record<string, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };
      return HttpResponse.json({
        plan: {
          code: plan,
          name: names[plan] ?? plan,
          price_bdt_minor: MOCK_PRICES[plan] ?? 0,
          features: ["ai_assistant", "client_reports", "sla_alerts", "meta_lead_ads"],
          limits: { seats: 10, clients: 10, ai_generations_per_month: 1000, client_reports_per_month: 50 },
        },
        assigned_plan: plan,
        trial_ends_at: null,
        trial_expired: false,
        usage: [
          { limit: "seats", max: 10, used: 4 },
          { limit: "clients", max: 10, used: 3 },
          { limit: "ai_generations_per_month", max: 1000, used: 42 },
          { limit: "client_reports_per_month", max: 50, used: db.reports.length },
        ],
        subscription: sub,
      });
    }
    return HttpResponse.json({
      plan: {
        code: "trial",
        name: "Trial",
        price_bdt_minor: 0,
        features: ["ai_assistant", "client_reports", "sla_alerts", "meta_lead_ads"],
        limits: { seats: 10, clients: 10, ai_generations_per_month: 300, client_reports_per_month: 20 },
      },
      assigned_plan: "trial",
      trial_ends_at: db.agency.trial_ends_at,
      trial_expired: false,
      usage: [
        { limit: "seats", max: 10, used: 4 },
        { limit: "clients", max: 10, used: 3 },
        { limit: "ai_generations_per_month", max: 300, used: 42 },
        { limit: "client_reports_per_month", max: 20, used: db.reports.length },
      ],
      subscription: null,
    });
  }),
  http.get(url("/v1/billing/prices"), () =>
    HttpResponse.json({
      country: db.agency.country,
      tier: "t3",
      currency: db.agency.default_currency,
      tax_note: "vat",
      checkout_online: true,
      plans: [
        {
          code: "starter",
          name: "Starter",
          price_bdt_minor: 149000,
          features: ["meta_lead_ads"],
          limits: { seats: 3, clients: 3, ai_generations_per_month: 0, client_reports_per_month: 0 },
        },
        {
          code: "growth",
          name: "Growth",
          price_bdt_minor: 299000,
          features: ["ai_assistant", "client_reports", "sla_alerts", "meta_lead_ads"],
          limits: { seats: 10, clients: 10, ai_generations_per_month: 1000, client_reports_per_month: 50 },
        },
        {
          code: "pro",
          name: "Pro",
          price_bdt_minor: 499000,
          features: ["ai_assistant", "client_reports", "sla_alerts", "meta_lead_ads", "custom_follow_ups"],
          limits: { seats: 25, clients: 30, ai_generations_per_month: 5000, client_reports_per_month: 300 },
        },
      ].map((p) => ({ ...p, monthly_minor: MOCK_PRICES[p.code]!, annual_minor: MOCK_PRICES[p.code]! * 10 })),
    }),
  ),
  http.post(url("/v1/billing/checkout"), async ({ request }) => {
    const body = (await request.json()) as { plan: string; interval: "month" | "year" };
    const b = mockBilling();
    if (b.subscription && b.subscription.status !== "canceled")
      return problem(409, "billing_has_subscription", "This agency already has a subscription. Change plan instead.");
    await delay(300);
    saveBilling({ ...b, subscription: mockSubscription(body.plan, body.interval) });
    return HttpResponse.json({ url: `${location.pathname}?checkout=success` });
  }),
  http.post(url("/v1/billing/change-plan"), async ({ request }) => {
    const body = (await request.json()) as { plan: string; interval: "month" | "year" };
    const b = mockBilling();
    if (!b.subscription) return problem(409, "billing_no_subscription", "This agency has no subscription yet.");
    const sub = mockSubscription(body.plan, body.interval);
    saveBilling({ ...b, subscription: sub });
    return HttpResponse.json(sub);
  }),
  http.post(url("/v1/billing/portal"), () => {
    if (!mockBilling().subscription)
      return problem(409, "billing_no_subscription", "This agency has no subscription yet.");
    return HttpResponse.json({ url: location.pathname });
  }),
  http.get(url("/v1/billing/invoices"), () => {
    const sub = mockBilling().subscription;
    if (!sub) return HttpResponse.json({ data: [] });
    const created = db.iso(db.now() - 60_000);
    return HttpResponse.json({
      data: [
        {
          id: "in_mock_1",
          number: "LDX-0001",
          status: "paid",
          total_minor: Math.round((sub.amount_minor ?? 0) * 1.15),
          tax_minor: Math.round((sub.amount_minor ?? 0) * 0.15),
          currency: sub.currency ?? "BDT",
          hosted_url: "https://invoice.stripe.test/in_mock_1",
          pdf_url: "https://invoice.stripe.test/in_mock_1.pdf",
          created_at: created,
          period_start: created,
          period_end: sub.current_period_end ?? created,
          paid_at: created,
        },
      ],
    });
  }),
  http.get(url("/v1/billing/usage"), () => HttpResponse.json(mockUsage(mockBilling()))),
  http.put(url("/v1/billing/budgets/:meter"), async ({ params, request }) => {
    const body = (await request.json()) as { monthly_limit: number | null };
    const b = mockBilling();
    const budgets = { ...b.budgets };
    if (body.monthly_limit == null) delete budgets[String(params.meter)];
    else budgets[String(params.meter)] = body.monthly_limit;
    saveBilling({ ...b, budgets });
    return HttpResponse.json(mockUsage({ ...b, budgets }));
  }),
  http.get(url("/v1/billing/plans"), () =>
    HttpResponse.json({
      data: [
        {
          code: "starter",
          name: "Starter",
          price_bdt_minor: 149000,
          features: ["meta_lead_ads"],
          limits: { seats: 3, clients: 3, ai_generations_per_month: 0, client_reports_per_month: 0 },
        },
        {
          code: "growth",
          name: "Growth",
          price_bdt_minor: 299000,
          features: ["ai_assistant", "client_reports", "sla_alerts", "meta_lead_ads"],
          limits: { seats: 10, clients: 10, ai_generations_per_month: 1000, client_reports_per_month: 50 },
        },
        {
          code: "pro",
          name: "Pro",
          price_bdt_minor: 499000,
          features: ["ai_assistant", "client_reports", "sla_alerts", "meta_lead_ads", "custom_follow_ups"],
          limits: { seats: 25, clients: 30, ai_generations_per_month: 5000, client_reports_per_month: 300 },
        },
      ],
    }),
  ),
  http.get(url("/v1/integrations/meta"), () =>
    HttpResponse.json({ configured: false, messaging_available: false, connections: [], pages: [], forms: [] }),
  ),
  http.post(url("/v1/clients/:id/sources"), async ({ params, request }) => {
    const b = (await request.json()) as { kind: S["Source"]["kind"]; name: string };
    const key = db.newId().replace(/-/g, "") + "abcdef012345";
    const s: S["Source"] = {
      id: db.newId(),
      client_id: String(params.id),
      kind: b.kind,
      name: b.name,
      status: "active",
      public_key: b.kind === "web_form" ? key : null,
      endpoint_url: b.kind === "web_form" ? `http://localhost:8080/v1/ingest/forms/${key}` : null,
      allowed_origins: [],
      requires_signature: false,
      otp_required: false,
      inbound_address: b.kind === "email_in" ? `leads+${key}@in.recov.app` : null,
      last_received_at: null,
      created_at: db.iso(db.now()),
    };
    db.sources.push(s);
    return HttpResponse.json(s, { status: 201 });
  }),
  http.get(url("/v1/ingestion/review"), () => HttpResponse.json(list(db.reviewItems))),
  http.get(url("/v1/ingestion/review/count"), () => HttpResponse.json({ count: db.reviewItems.length })),
  http.post(url("/v1/ingestion/review/:id/accept"), async ({ params, request }) => {
    const i = db.reviewItems.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Nothing to review here.");
    const b = (await request.json()) as { full_name?: string; phone?: string };
    const item = db.reviewItems.splice(i, 1)[0]!;
    const digits = (b.phone ?? "").replace(/\D/g, "");
    const l: S["LeadDetail"] = {
      ...db.leads[0]!,
      id: db.newId(),
      client_id: item.client_id,
      source_id: item.source_id,
      full_name: b.full_name ?? "",
      phone: digits ? { e164: `+${digits}`, display: b.phone ?? "" } : null,
      stage: "new",
      received_at: item.received_at,
      first_attempt_at: null,
      first_response_at: null,
      sla: { status: "on_track", due_at: db.iso(db.now() + 15 * 60_000), kind: "first_response" },
    };
    db.leads.unshift(l);
    db.activities.set(l.id, []);
    return HttpResponse.json(l, { status: 201 });
  }),
  http.post(url("/v1/ingestion/review/:id/reject"), ({ params }) => {
    const i = db.reviewItems.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Nothing to review here.");
    db.reviewItems.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/leads/:id/conversations"), ({ params }) =>
    HttpResponse.json(list(db.conversations.get(String(params.id)) ?? [])),
  ),
  http.get(url("/v1/integrations/meta/unrouted"), () => HttpResponse.json(list([]))),
  http.get(url("/v1/ingestion/issues"), () => HttpResponse.json(list([]))),

  http.post(url("/v1/auth/otp/start"), () => HttpResponse.json({ challenge_id: db.newId() }, { status: 202 })),
  http.post(url("/v1/auth/otp/verify"), async ({ request }) => {
    const b = (await request.json()) as { code: string };
    return b.code.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)) === "123456"
      ? HttpResponse.json(db.me)
      : problem(401, "otp_invalid", "That code isn't right or has expired. Request a new one.");
  }),
  http.get(url("/v1/clients/:id/adoption"), ({ params }) => {
    const staff = db.members.filter((m) => m.role === "agent");
    return HttpResponse.json({
      client_id: String(params.id),
      since: db.iso(db.now() - 30 * 86400_000),
      assigned_leads: 41,
      with_outcome: 14,
      outcome_rate: 14 / 41,
      median_log_delay_seconds: 7800,
      staff_total: staff.length,
      staff_active: 1,
      action_links: { created: 22, used: 9 },
      staff: staff.map((m, i) => ({
        user_id: m.user.id,
        last_activity_at: i === 0 ? db.iso(db.now() - 3600_000) : null,
        active: i === 0,
        waiting_leads: i === 0 ? 1 : 6,
        has_phone: true,
      })),
      last_reminded_at: null,
    });
  }),
  http.post(url("/v1/clients/:id/adoption/remind"), () => HttpResponse.json({ reminded: 1 })),

  http.get(url("/v1/conversations"), ({ request }) => {
    const q = new URL(request.url).searchParams;
    let rows = db.inbox
      .slice()
      .sort((a, b) => Date.parse(b.last_message_at ?? "") - Date.parse(a.last_message_at ?? ""));
    if (q.get("unread") === "true") rows = rows.filter((c) => c.unread_count > 0);
    if (q.get("client_id")) rows = rows.filter((c) => c.client_id === q.get("client_id"));
    if (q.get("channel")) rows = rows.filter((c) => c.channel === q.get("channel"));
    return HttpResponse.json(list(rows));
  }),
  http.get(url("/v1/conversations/:id"), ({ params }) => {
    const c = db.inbox.find((x) => x.id === params.id);
    return c ? HttpResponse.json(c) : problem(404, "not_found", "Conversation not found.");
  }),
  http.get(url("/v1/conversations/:id/messages"), ({ params }) =>
    HttpResponse.json(list(db.inboxMessages.get(String(params.id)) ?? [])),
  ),
  http.post(url("/v1/conversations/:id/messages"), async ({ params, request }) => {
    const c = db.inbox.find((x) => x.id === params.id);
    if (!c) return problem(404, "not_found", "Conversation not found.");
    if (db.messagingSettings.paused) return problem(409, "messaging_paused", "Messaging is paused for this agency.");
    const b = (await request.json()) as { text?: string; template?: { name: string; language: string } };
    if (!b.template && !c.window_open)
      return problem(
        400,
        "template_required",
        "More than 24 hours since their last message: send an approved template.",
      );
    const tpl =
      b.template && db.messageTemplates.find((x) => x.name === b.template!.name && x.language === b.template!.language);
    const body = tpl
      ? tpl.body.replace("{{1}}", c.lead.name.split(" ")[0] ?? "").replace("{{2}}", "Dhaka Dental Care")
      : (b.text ?? "");
    const m: S["Message"] = {
      id: db.newId(),
      conversation_id: c.id,
      lead_id: c.lead.id,
      channel: c.channel,
      direction: "outbound",
      kind: tpl ? "template" : "text",
      body,
      template_name: tpl?.name ?? null,
      status: "sent",
      error: null,
      sent_by: db.me.user.id,
      automated: false,
      activity_id: db.newId(),
      created_at: db.iso(db.now()),
      sent_at: db.iso(db.now()),
      delivered_at: null,
      read_at: null,
    };
    db.inboxMessages.set(c.id, [m, ...(db.inboxMessages.get(c.id) ?? [])]);
    Object.assign(c, {
      last_message_at: m.created_at,
      last_message_preview: body,
      last_direction: "outbound",
      unread_count: 0,
    });
    return HttpResponse.json(m, { status: 201 });
  }),
  http.post(url("/v1/conversations/:id/claim"), ({ params }) => {
    const c = db.inbox.find((x) => x.id === params.id);
    if (!c) return problem(404, "not_found", "Conversation not found.");
    if (c.claimed_by && c.claimed_by !== db.me.user.id)
      return problem(409, "conversation_claimed", "Someone else is replying to this conversation.");
    Object.assign(c, { claimed_by: db.me.user.id, claimed_until: db.iso(db.now() + 120_000) });
    return HttpResponse.json(c);
  }),
  http.delete(url("/v1/conversations/:id/claim"), () => new HttpResponse(null, { status: 204 })),
  http.post(url("/v1/conversations/:id/read"), ({ params }) => {
    const c = db.inbox.find((x) => x.id === params.id);
    if (c) c.unread_count = 0;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/clients/:id/channels"), ({ params }) =>
    HttpResponse.json(list(db.channelAccounts.filter((a) => a.client_id === params.id))),
  ),
  http.post(url("/v1/clients/:id/channels/whatsapp"), async ({ params, request }) => {
    const b = (await request.json()) as { phone_number_id: string; display_phone?: string };
    const a: S["ChannelAccount"] = {
      id: db.newId(),
      client_id: String(params.id),
      channel: "whatsapp",
      provider: "whatsapp_cloud",
      external_id: b.phone_number_id,
      display_name: b.display_phone ?? "",
      status: "active",
      created_at: db.iso(db.now()),
    };
    db.channelAccounts.push(a);
    return HttpResponse.json(a, { status: 201 });
  }),
  http.get(url("/v1/channels/:id/templates"), ({ params }) =>
    HttpResponse.json(list(db.messageTemplates.filter((x) => x.channel_account_id === params.id))),
  ),
  http.post(url("/v1/channels/:id/templates/sync"), ({ params }) =>
    HttpResponse.json(list(db.messageTemplates.filter((x) => x.channel_account_id === params.id))),
  ),
  http.put(url("/v1/templates/:id/variables"), async ({ params, request }) => {
    const tpl = db.messageTemplates.find((x) => x.id === params.id);
    if (!tpl) return problem(404, "not_found", "Template not found.");
    tpl.variables = ((await request.json()) as { variables: S["MessageTemplate"]["variables"] }).variables;
    return HttpResponse.json(tpl);
  }),
  http.get(url("/v1/messaging/settings"), () => HttpResponse.json(db.messagingSettings)),
  http.put(url("/v1/messaging/settings"), async ({ request }) => {
    Object.assign(db.messagingSettings, await request.json());
    return HttpResponse.json(db.messagingSettings);
  }),

  http.get(url("/v1/clients/:id/auto-responder"), () => HttpResponse.json(db.autoResponder)),
  http.put(url("/v1/clients/:id/auto-responder"), async ({ request }) => {
    const b = (await request.json()) as S["AutoResponder"];
    if (b.enabled && b.channel === "whatsapp" && !b.template_name)
      return problem(422, "validation_failed", "Pick an approved template.");
    Object.assign(db.autoResponder, b);
    return HttpResponse.json(db.autoResponder);
  }),

  http.get(url("/v1/calls"), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const rows = db.calls
      .map(progress)
      .filter(
        (c) =>
          (!q.get("lead_id") || c.lead_id === q.get("lead_id")) &&
          (!q.get("client_id") || c.client_id === q.get("client_id")),
      );
    return HttpResponse.json(list(rows));
  }),
  http.get(url("/v1/calls/coaching"), () => HttpResponse.json(list(db.coaching))),
  http.get(url("/v1/calls/:id"), ({ params }) => {
    const c = db.calls.find((x) => x.id === params.id);
    return c ? HttpResponse.json(progress(c)) : problem(404, "not_found", "Call not found.");
  }),
  http.get(url("/v1/calls/:id/recording"), () =>
    HttpResponse.arrayBuffer(new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer, {
      headers: { "Content-Type": "audio/mpeg" },
    }),
  ),
  http.post(url("/v1/leads/:id/calls"), async ({ params }) => {
    await delay(300);
    const l = findLead(String(params.id));
    if (!l?.phone) return problem(400, "lead_has_no_phone", "This lead has no phone number.");
    if (l.do_not_contact) return problem(403, "contact_not_allowed", "This lead asked not to be contacted.");
    if (!db.myCallPhone.phone) return problem(400, "no_agent_phone", "Add the phone you answer calls on.");
    const n = db.voiceNumbers.find(
      (x) => x.client_id === l.client_id && x.provider === "twilio" && x.status === "active",
    );
    if (!n) return problem(400, "no_voice_number", "No calling number is connected for this client.");
    const at = db.iso(db.now());
    const c: S["Call"] = {
      id: db.newId(),
      client_id: l.client_id,
      lead_id: l.id,
      lead_name: l.full_name ?? "",
      direction: "outbound",
      status: "ringing",
      from: n.number,
      to: l.phone.e164,
      agent_user_id: db.me.user.id,
      provider: "twilio",
      started_at: at,
      answered_at: null,
      ended_at: null,
      duration_seconds: 0,
      recording_status: "none",
      recording_seconds: 0,
      transcript_status: "none",
      transcript: [],
      summary: null,
      activity_id: null,
    };
    db.calls.unshift(c);
    return HttpResponse.json(c, { status: 201 });
  }),
  http.get(url("/v1/clients/:id/voice-numbers"), ({ params }) =>
    HttpResponse.json(list(db.voiceNumbers.filter((n) => n.client_id === params.id))),
  ),
  http.post(url("/v1/clients/:id/voice-numbers"), async ({ params, request }) => {
    const b = (await request.json()) as { provider: "twilio" | "pbx"; number: string; account_id?: string };
    if (db.voiceNumbers.some((n) => n.number === b.number && n.status === "active"))
      return problem(409, "number_taken", "This number is already connected.");
    const id = db.newId();
    const n: S["VoiceNumber"] = {
      id,
      client_id: String(params.id),
      provider: b.provider,
      number: b.number,
      external_id: b.account_id ?? null,
      webhook_url: b.provider === "pbx" ? `${API}/v1/webhooks/voice/pbx/${id.replaceAll("-", "")}demo` : null,
      status: "active",
      created_at: db.iso(db.now()),
    };
    db.voiceNumbers.push(n);
    return HttpResponse.json(n, { status: 201 });
  }),
  http.delete(url("/v1/voice-numbers/:id"), ({ params }) => {
    const n = db.voiceNumbers.find((x) => x.id === params.id);
    if (n) n.status = "disconnected";
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/calls-settings"), () => HttpResponse.json(db.callSettings)),
  http.put(url("/v1/calls-settings"), async ({ request }) => {
    const b = (await request.json()) as S["CallSettings"];
    if (b.record_calls && !b.recording_notice.trim())
      return problem(422, "validation_failed", "A recording notice is required.");
    Object.assign(db.callSettings, b);
    return HttpResponse.json(db.callSettings);
  }),
  http.get(url("/v1/me/call-phone"), () => HttpResponse.json(db.myCallPhone)),
  http.put(url("/v1/me/call-phone"), async ({ request }) => {
    const b = (await request.json()) as { phone: string | null };
    const digits = b.phone?.replace(/\D/g, "") ?? "";
    db.myCallPhone.phone = !digits ? null : digits.startsWith("880") ? `+${digits}` : `+880${digits.replace(/^0/, "")}`;
    return HttpResponse.json(db.myCallPhone);
  }),

  http.get(url("/v1/sequences"), ({ request }) => {
    const client = new URL(request.url).searchParams.get("client_id");
    return HttpResponse.json(
      list(db.sequences.filter((s) => s.status !== "archived" && (!client || !s.client_id || s.client_id === client))),
    );
  }),
  http.post(url("/v1/sequences/preview"), async ({ request }) => {
    const b = (await request.json()) as { trigger: S["SequenceTrigger"] };
    const pool = db.leads.filter((l) => l.phone && !l.do_not_contact);
    const n =
      b.trigger.kind === "no_answer"
        ? Math.max(0, 14 - 3 * (b.trigger.attempts ?? 2))
        : b.trigger.kind === "lost"
          ? (b.trigger.reasons?.length ?? 0) * 4
          : 9;
    const preview: S["SequencePreview"] = {
      eligible_now: n,
      last_30_days: Math.ceil(n * 0.6),
      capped: false,
      sample: pool.slice(0, Math.min(3, n)).map((l) => ({
        lead_id: l.id,
        name: l.full_name ?? "",
        stage: l.stage,
        qualifies_at: db.iso(db.now() - 26 * 3600_000),
      })),
    };
    return HttpResponse.json(preview);
  }),
  http.post(url("/v1/sequences"), async ({ request }) => {
    const b = (await request.json()) as S["SequenceInput"];
    if (!b.steps.some((s) => s.type !== "wait") || b.steps.at(-1)?.type === "wait")
      return HttpResponse.json(
        {
          type: "https://docs.recov.app/problems/validation_failed",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          errors: [{ field: "steps", code: "invalid", message: "Add a step that does something." }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    const at = db.iso(db.now());
    const s: S["Sequence"] = {
      id: db.newId(),
      client_id: b.client_id ?? null,
      name: b.name,
      status: "draft",
      trigger: b.trigger,
      steps: b.steps,
      exit_on: b.exit_on ?? ["reply", "stage_changed", "sale", "opt_out"],
      holdout_percent: b.holdout_percent ?? 10,
      version: 1,
      activated_at: null,
      created_at: at,
      updated_at: at,
    };
    db.sequences.unshift(s);
    return HttpResponse.json(s, { status: 201 });
  }),
  http.get(url("/v1/sequences/:id"), ({ params }) => {
    const s = db.sequences.find((x) => x.id === params.id);
    return s ? HttpResponse.json(s) : problem(404, "not_found", "Sequence not found.");
  }),
  http.put(url("/v1/sequences/:id"), async ({ params, request }) => {
    const s = db.sequences.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Sequence not found.");
    Object.assign(s, await request.json(), { version: s.version + 1, updated_at: db.iso(db.now()) });
    return HttpResponse.json(s);
  }),
  http.post(url("/v1/sequences/:id/status"), async ({ params, request }) => {
    const s = db.sequences.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Sequence not found.");
    const { status } = (await request.json()) as { status: S["Sequence"]["status"] };
    Object.assign(s, { status, activated_at: s.activated_at ?? (status === "active" ? db.iso(db.now()) : null) });
    return HttpResponse.json(s);
  }),
  http.get(url("/v1/sequences/:id/report"), ({ params }) => {
    const s = db.sequences.find((x) => x.id === params.id);
    if (!s) return problem(404, "not_found", "Sequence not found.");
    const running = s.status !== "draft";
    const report: S["SequenceReport"] = {
      sequence: s,
      enrolled: running
        ? { active: 38, completed: 102, exited: 46, holdout: 21 }
        : { active: 0, completed: 0, exited: 0, holdout: 0 },
      exits: running ? { reply: 31, sale: 9, opt_out: 4, stopped: 2 } : {},
      steps: s.steps.map((st, i) => ({
        step_no: i,
        type: st.type,
        done: running && st.type !== "wait" ? 150 - i * 30 : 0,
        skipped: running && st.type !== "wait" ? 12 : 0,
        failed: 0,
        reasons: running && st.type !== "wait" ? [{ reason: "contact_not_allowed", count: 12 }] : [],
      })),
      recovered: running
        ? db.recovered
        : {
            ...db.recovered,
            treated_leads: 0,
            holdout_leads: 0,
            treated_converted: 0,
            holdout_converted: 0,
            treated_revenue_minor: 0,
            holdout_revenue_minor: 0,
            treated_conversion_rate: null,
            holdout_conversion_rate: null,
            incremental_revenue_minor: null,
          },
      recent: running ? db.enrollments.filter((e) => e.sequence_id === s.id) : [],
    };
    return HttpResponse.json(report);
  }),
  http.get(url("/v1/recovery/summary"), () => HttpResponse.json(db.recovered)),
  http.get(url("/v1/leads/:id/sequence-enrollments"), ({ params }) =>
    HttpResponse.json(list(db.enrollments.filter((e) => e.lead_id === params.id))),
  ),
  http.post(url("/v1/leads/:id/sequence-enrollments"), async ({ params, request }) => {
    const { sequence_id } = (await request.json()) as { sequence_id: string };
    const s = db.sequences.find((x) => x.id === sequence_id);
    if (!s) return problem(404, "not_found", "Sequence not found.");
    if (s.status !== "active") return problem(409, "sequence_not_active", "Activate the sequence first.");
    if (db.enrollments.some((e) => e.lead_id === params.id && (e.status === "active" || e.sequence_id === s.id)))
      return problem(409, "already_enrolled", "This lead is in a sequence already.");
    const l = findLead(String(params.id));
    const e: S["SequenceEnrollment"] = {
      id: db.newId(),
      sequence_id: s.id,
      sequence_name: s.name,
      lead_id: String(params.id),
      lead_name: l?.full_name ?? "",
      status: "active",
      step_no: 0,
      step_count: s.steps.length,
      next_step: s.steps[0] ?? null,
      next_step_at: db.iso(db.now() + 60_000),
      exit_reason: null,
      enrolled_by: db.me.user.id,
      enrolled_at: db.iso(db.now()),
      ended_at: null,
    };
    db.enrollments.unshift(e);
    return HttpResponse.json(e, { status: 201 });
  }),
  http.post(url("/v1/sequence-enrollments/:id/stop"), ({ params }) => {
    const e = db.enrollments.find((x) => x.id === params.id);
    if (!e) return problem(404, "not_found", "Enrollment not found.");
    Object.assign(e, {
      status: "exited",
      exit_reason: "stopped",
      next_step: null,
      next_step_at: null,
      ended_at: db.iso(db.now()),
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/v1/automation/rules"), () => HttpResponse.json(list(db.rules))),
  http.post(url("/v1/automation/rules/test"), async ({ request }) => {
    const { rule, lead_id } = (await request.json()) as { rule: S["AutomationRuleInput"]; lead_id: string };
    const l = findLead(lead_id);
    const actual = (field: string): unknown =>
      field === "lead.stage"
        ? l?.stage
        : field === "lead.source_kind"
          ? "web_form"
          : field === "lead.tags"
            ? (l?.tags ?? [])
            : null;
    const checks = rule.conditions.rules.map((c) => {
      const a = actual(c.field);
      const result =
        c.op === "eq"
          ? String(a ?? "") === String(c.value ?? "")
          : c.op === "exists"
            ? a != null && a !== ""
            : c.op === "neq";
      return { field: c.field, op: c.op, value: c.value, actual: a, result };
    });
    const matched = rule.conditions.match === "any" ? checks.some((c) => c.result) : checks.every((c) => c.result);
    const res: S["AutomationTestResult"] = { matched, checks, actions: matched ? rule.actions : [] };
    return HttpResponse.json(res);
  }),
  http.post(url("/v1/automation/rules/simulate"), async ({ request }) => {
    const { rule } = (await request.json()) as { rule: S["AutomationRuleInput"] };
    const pool = db.leads.slice(0, 5);
    const sim: S["AutomationSimulation"] = {
      events: 42,
      matched: Math.max(0, 12 - rule.conditions.rules.length * 3),
      capped: false,
      note: "current_lead_state",
      sample: pool.slice(0, 3).map((l, i) => ({
        event_id: db.newId(),
        lead_id: l.id,
        lead_name: l.full_name ?? "",
        at: db.iso(db.now() - (i + 1) * 9 * 3600_000),
      })),
    };
    return HttpResponse.json(sim);
  }),
  http.post(url("/v1/automation/rules"), async ({ request }) => {
    const b = (await request.json()) as S["AutomationRuleInput"];
    if (!b.actions.length)
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          errors: [{ field: "actions", code: "invalid", message: "Between 1 and 5 actions." }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    const at = db.iso(db.now());
    const r: S["AutomationRule"] = {
      id: db.newId(),
      name: b.name,
      client_id: b.client_id ?? null,
      event: b.event,
      conditions: { match: b.conditions.match ?? "all", rules: b.conditions.rules },
      actions: b.actions,
      rate_per_hour: b.rate_per_hour || 100,
      enabled: false,
      version: 1,
      webhook_secret: "whsec_" + db.newId().replaceAll("-", ""),
      last_24h: {},
      created_at: at,
      updated_at: at,
    };
    db.rules.unshift(r);
    return HttpResponse.json(r, { status: 201 });
  }),
  http.get(url("/v1/automation/rules/:id"), ({ params }) => {
    const r = db.rules.find((x) => x.id === params.id);
    return r ? HttpResponse.json(r) : problem(404, "not_found", "Rule not found.");
  }),
  http.put(url("/v1/automation/rules/:id"), async ({ params, request }) => {
    const r = db.rules.find((x) => x.id === params.id);
    if (!r) return problem(404, "not_found", "Rule not found.");
    const b = (await request.json()) as S["AutomationRuleInput"];
    Object.assign(r, b, {
      conditions: { match: b.conditions.match ?? "all", rules: b.conditions.rules },
      version: r.version + 1,
      updated_at: db.iso(db.now()),
    });
    return HttpResponse.json(r);
  }),
  http.delete(url("/v1/automation/rules/:id"), ({ params }) => {
    const i = db.rules.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Rule not found.");
    db.rules.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/automation/rules/:id/enabled"), async ({ params, request }) => {
    const r = db.rules.find((x) => x.id === params.id);
    if (!r) return problem(404, "not_found", "Rule not found.");
    r.enabled = ((await request.json()) as { enabled: boolean }).enabled;
    return HttpResponse.json(r);
  }),
  http.get(url("/v1/automation/rules/:id/versions"), ({ params }) => {
    const r = db.rules.find((x) => x.id === params.id);
    if (!r) return problem(404, "not_found", "Rule not found.");
    const def = (v: number): S["AutomationRuleInput"] => ({
      name: r.name,
      client_id: r.client_id,
      event: r.event,
      conditions: v === r.version ? r.conditions : { match: "all", rules: r.conditions.rules.slice(0, 1) },
      actions: v === r.version ? r.actions : r.actions.slice(0, 1),
      rate_per_hour: r.rate_per_hour,
    });
    const versions: S["AutomationRuleVersion"][] = Array.from({ length: r.version }, (_, i) => r.version - i).map(
      (v) => ({
        version: v,
        definition: def(v),
        created_by: db.me.user.id,
        created_at: db.iso(db.now() - (r.version - v + 1) * 86400_000),
      }),
    );
    return HttpResponse.json(list(versions));
  }),
  http.get(url("/v1/automation/rules/:id/runs"), ({ params, request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const first = db.rules[0]?.id === params.id;
    return HttpResponse.json(list(first ? db.ruleRuns.filter((r) => !status || r.status === status) : []));
  }),

  http.get(url("/v1/connectors"), () => HttpResponse.json({ data: db.connectorCatalog })),
  http.get(url("/v1/connector-installs"), ({ request }) => {
    const client = new URL(request.url).searchParams.get("client_id");
    const rows = db.connectorInstalls
      .filter((i) => !client || i.client_id === client)
      .map(({ last_24h: _l, deliveries: _d, ...i }) => i);
    return HttpResponse.json({ data: rows });
  }),
  http.post(url("/v1/connector-installs"), async ({ request }) => {
    const b = (await request.json()) as { connector: string; client_id: string; name?: string };
    const m = db.connectorCatalog.find((x) => x.key === b.connector);
    if (!m) return problem(404, "not_found", "Unknown connector.");
    const i = db.newConnectorInstall(b.connector, b.client_id, b.name?.trim() || m.name);
    db.connectorInstalls.unshift(i);
    const { last_24h: _l, deliveries: _d, ...install } = i;
    return HttpResponse.json({ install, credentials: db.connectorCredentials(i) }, { status: 201 });
  }),
  http.get(url("/v1/connector-installs/:id"), ({ params }) => {
    const i = db.connectorInstalls.find((x) => x.id === params.id);
    return i ? HttpResponse.json(i) : problem(404, "not_found", "Connector not found.");
  }),
  http.patch(url("/v1/connector-installs/:id"), async ({ params, request }) => {
    const i = db.connectorInstalls.find((x) => x.id === params.id);
    if (!i) return problem(404, "not_found", "Connector not found.");
    const b = (await request.json()) as Partial<
      Pick<S["ConnectorInstall"], "name" | "status" | "field_map" | "settings">
    >;
    Object.assign(i, b);
    const src = db.sources.find((s) => s.id === i.source_id);
    if (src && b.status) src.status = b.status;
    if (src && b.name) src.name = b.name;
    const { last_24h: _l, deliveries: _d, ...install } = i;
    return HttpResponse.json(install);
  }),
  http.delete(url("/v1/connector-installs/:id"), ({ params }) => {
    const n = db.connectorInstalls.findIndex((x) => x.id === params.id);
    if (n < 0) return problem(404, "not_found", "Connector not found.");
    const [i] = db.connectorInstalls.splice(n, 1);
    const src = db.sources.find((s) => s.id === i!.source_id);
    if (src) src.status = "paused";
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/connector-installs/:id/rotate"), ({ params }) => {
    const i = db.connectorInstalls.find((x) => x.id === params.id);
    if (!i) return problem(404, "not_found", "Connector not found.");
    const { last_24h: _l, deliveries: _d, ...install } = i;
    return HttpResponse.json({ install, credentials: db.connectorCredentials(i) });
  }),

  http.get(url("/v1/clients/:id/conversions"), ({ params }) => {
    const id = params.id as string;
    return HttpResponse.json({
      settings: db.conversionSettings.get(id) ?? {
        accepted: false,
        accepted_at: null,
        accepted_by: null,
        terms_version: "dp1",
      },
      triggers: ["stage.contacted", "stage.qualified", "stage.won", "stage.lost", "sale"],
      destinations: db.destinations.filter((d) => d.client_id === id),
    } satisfies S["ConversionsOverview"]);
  }),
  http.put(url("/v1/clients/:id/conversions/terms"), async ({ params, request }) => {
    const b = (await request.json()) as { accepted: boolean };
    const s: S["ConversionSettings"] = b.accepted
      ? { accepted: true, accepted_at: db.iso(db.now()), accepted_by: db.me.user.id, terms_version: "dp1" }
      : { accepted: false, accepted_at: null, accepted_by: null, terms_version: "dp1" };
    db.conversionSettings.set(params.id as string, s);
    return HttpResponse.json(s);
  }),
  http.post(url("/v1/clients/:id/conversion-destinations"), async ({ params, request }) => {
    const b = (await request.json()) as {
      platform: "meta" | "google_ads";
      name?: string;
      dataset_id?: string;
      access_token?: string;
      test_event_code?: string;
      google_connection_id?: string;
      customer_id?: string;
      login_customer_id?: string;
      mapping?: Record<string, string>;
    };
    if (b.platform === "meta" && (!/^\d{5,20}$/.test(b.dataset_id ?? "") || (b.access_token ?? "").length < 20))
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          errors: [{ field: "dataset_id", code: "invalid", message: "must be the numeric dataset id" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    const cid = (b.customer_id ?? "").replace(/-/g, "");
    const d = db.newDestination(params.id as string, b.platform, {
      name: b.name || (b.platform === "meta" ? `Meta dataset ${b.dataset_id}` : `Google Ads ${cid}`),
      dataset_id: b.platform === "meta" ? b.dataset_id! : null,
      test_event_code: b.test_event_code || null,
      google_connection_id: b.google_connection_id ?? null,
      customer_id: b.platform === "google_ads" ? cid : null,
      login_customer_id: b.login_customer_id ?? null,
      mapping:
        b.mapping ??
        (b.platform === "meta"
          ? { "stage.contacted": "Contacted", "stage.qualified": "Qualified", "stage.won": "Won" }
          : {}),
    });
    db.destinations.push(d);
    db.conversionEvents.set(d.id, []);
    return HttpResponse.json(d, { status: 201 });
  }),
  http.patch(url("/v1/conversion-destinations/:id"), async ({ params, request }) => {
    const d = db.destinations.find((x) => x.id === params.id);
    if (!d) return problem(404, "not_found", "Not found.");
    const b = (await request.json()) as Partial<S["ConversionDestination"]> & { access_token?: string };
    const { access_token: _t, ...rest } = b;
    Object.assign(d, rest);
    if (b.test_event_code === "") d.test_event_code = null;
    if (b.mapping) d.mapping = Object.fromEntries(Object.entries(b.mapping).filter(([, v]) => v));
    return HttpResponse.json(d);
  }),
  http.delete(url("/v1/conversion-destinations/:id"), ({ params }) => {
    const i = db.destinations.findIndex((x) => x.id === params.id);
    if (i < 0) return problem(404, "not_found", "Not found.");
    db.destinations.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/conversion-destinations/:id/events"), ({ params, request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const rows = (db.conversionEvents.get(params.id as string) ?? []).filter((e) => !status || e.status === status);
    return HttpResponse.json({ data: rows, next_cursor: null });
  }),
  http.get(url("/v1/conversion-destinations/:id/stats"), ({ params }) =>
    HttpResponse.json(db.conversionStats(params.id as string)),
  ),
  http.post(url("/v1/conversion-destinations/:id/test"), ({ params }) => {
    const d = db.destinations.find((x) => x.id === params.id);
    if (!d) return problem(404, "not_found", "Not found.");
    if (d.platform === "meta" && !d.test_event_code)
      return problem(400, "test_event_code_required", "Add the test event code first.");
    return HttpResponse.json(
      d.platform === "meta"
        ? { ok: true, message: "Meta received 1 test event. Check Events Manager → Test events." }
        : { ok: true, message: "Connected. 2 conversion actions can receive uploads." },
    );
  }),
  http.post(url("/v1/conversion-destinations/:id/retry"), ({ params }) => {
    const rows = db.conversionEvents.get(params.id as string) ?? [];
    let n = 0;
    for (const e of rows)
      if (e.status === "failed" || e.status === "dead") {
        e.status = "pending";
        e.attempts = 0;
        e.last_error = null;
        n++;
      }
    return HttpResponse.json({ requeued: n });
  }),
  http.get(url("/v1/integrations/google"), () =>
    HttpResponse.json({ configured: true, connections: db.googleConnections } satisfies S["GoogleOverview"]),
  ),
  http.post(url("/v1/integrations/google/connect"), () =>
    HttpResponse.json({
      authorize_url: `${window.location.origin}/en/integrations/google/callback?code=mock&state=mock`,
    }),
  ),
  http.post(url("/v1/integrations/google/callback"), () => {
    const c = {
      id: db.newId(),
      email: "second@agency.example",
      status: "active" as const,
      last_error: null,
      created_at: db.iso(db.now()),
    };
    if (!db.googleConnections.some((x) => x.email === c.email)) db.googleConnections.push(c);
    return HttpResponse.json(c);
  }),
  http.delete(url("/v1/integrations/google/connections/:id"), ({ params }) => {
    const i = db.googleConnections.findIndex((x) => x.id === params.id);
    if (i >= 0) db.googleConnections.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/integrations/google/connections/:id/customers"), () =>
    HttpResponse.json({ data: db.googleCustomers }),
  ),
  http.get(url("/v1/integrations/google/connections/:id/conversion-actions"), () =>
    HttpResponse.json({ data: db.googleActions }),
  ),
  http.get(url("/v1/integrations/ad-accounts"), ({ request }) => {
    const u = new URL(request.url);
    if (u.searchParams.get("platform") === "meta") return HttpResponse.json({ data: db.availableMetaAccounts });
    const conn = u.searchParams.get("connection_id") ?? "";
    return HttpResponse.json({
      data: db.googleCustomers.map((c) => ({
        platform: "google_ads" as const,
        external_id: c.id,
        name: c.name,
        currency: c.currency,
        connection_id: conn,
        manager: c.manager,
      })),
    });
  }),
  http.get(url("/v1/clients/:id/ad-accounts"), ({ params }) =>
    HttpResponse.json({ data: db.adAccounts.filter((a) => a.client_id === params.id) }),
  ),
  http.post(url("/v1/clients/:id/ad-accounts"), async ({ params, request }) => {
    const b = (await request.json()) as { platform: "meta" | "google_ads"; external_id: string; connection_id: string };
    const client = db.clients.find((c) => c.id === params.id);
    const avail =
      b.platform === "meta"
        ? db.availableMetaAccounts.find((a) => a.external_id === b.external_id)
        : db.googleCustomers
            .map((c) => ({ external_id: c.id, name: c.name, currency: c.currency }))
            .find((a) => a.external_id === b.external_id);
    if (!avail) return problem(422, "validation_failed", "Unknown ad account.");
    if (client && avail.currency !== client.currency)
      return problem(400, "ad_account_currency_mismatch", "This ad account bills in another currency.");
    if (db.adAccounts.some((a) => a.client_id === params.id && a.external_id === b.external_id))
      return problem(409, "ad_account_linked", "Already linked.");
    const a: S["AdAccount"] = {
      id: db.newId(),
      client_id: params.id as string,
      platform: b.platform,
      external_id: b.external_id,
      name: avail.name,
      currency: avail.currency,
      meta_connection_id: b.platform === "meta" ? b.connection_id : null,
      google_connection_id: b.platform === "google_ads" ? b.connection_id : null,
      login_customer_id: null,
      status: "active",
      health: "healthy",
      consecutive_failures: 0,
      last_synced_at: db.iso(db.now()),
      synced_through: db.iso(db.now()).slice(0, 10),
      last_error: null,
      created_at: db.iso(db.now()),
    };
    db.adAccounts.push(a);
    return HttpResponse.json(a, { status: 201 });
  }),
  http.patch(url("/v1/ad-accounts/:id"), async ({ params, request }) => {
    const a = db.adAccounts.find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Not found.");
    a.status = ((await request.json()) as { status: "active" | "paused" }).status;
    return HttpResponse.json(a);
  }),
  http.delete(url("/v1/ad-accounts/:id"), ({ params }) => {
    const i = db.adAccounts.findIndex((x) => x.id === params.id);
    if (i >= 0) db.adAccounts.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/ad-accounts/:id/sync"), ({ params }) => {
    const a = db.adAccounts.find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Not found.");
    a.last_synced_at = db.iso(db.now());
    return HttpResponse.json(a);
  }),

  http.get(url("/v1/developer/catalog"), () => HttpResponse.json(db.developerCatalog)),
  http.get(url("/v1/api-keys"), () => HttpResponse.json({ data: db.apiKeys })),
  http.post(url("/v1/api-keys"), async ({ request }) => {
    const b = (await request.json()) as { name: string; scopes: S["ApiScope"][]; expires_at?: string | null };
    if (!b.name?.trim() || !b.scopes?.length) return problem(422, "validation_failed", "Name and scopes are required.");
    const secret = `rkp.mock.${db.newId().replace(/-/g, "").slice(0, 22)}.${db.newId().replace(/-/g, "")}`;
    const key: S["ApiKey"] = {
      id: db.newId(),
      name: b.name.trim(),
      scopes: [...new Set(b.scopes)].sort(),
      hint: secret.slice(-4),
      status: "active",
      created_by: db.me.user.id,
      created_at: db.iso(db.now()),
      expires_at: b.expires_at ?? null,
      last_used_at: null,
      revoked_at: null,
      app_key: null,
    };
    db.apiKeys.unshift(key);
    return HttpResponse.json({ key, secret }, { status: 201 });
  }),
  http.delete(url("/v1/api-keys/:id"), ({ params }) => {
    const k = db.apiKeys.find((x) => x.id === params.id);
    if (!k) return problem(404, "not_found", "Key not found.");
    if (!k.revoked_at) Object.assign(k, { status: "revoked", revoked_at: db.iso(db.now()) });
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/webhook-endpoints"), () => HttpResponse.json({ data: db.webhookEndpoints })),
  http.post(url("/v1/webhook-endpoints"), async ({ request }) => {
    const b = (await request.json()) as {
      url: string;
      description?: string;
      events: S["WebhookEventType"][];
      client_ids?: string[];
    };
    if (!/^https:\/\/[^/\s]+/.test(b.url ?? ""))
      return HttpResponse.json(
        {
          type: "https://docs.recov.app/problems/validation_failed",
          title: "validation_failed",
          status: 422,
          code: "validation_failed",
          detail: "One or more fields are invalid.",
          errors: [{ field: "url", code: "invalid", message: "an https:// address on the public internet" }],
        },
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      );
    const ep: S["WebhookEndpoint"] = {
      id: db.newId(),
      url: b.url,
      description: b.description?.trim() ?? "",
      events: b.events,
      client_ids: b.client_ids ?? [],
      status: "active",
      disabled_reason: null,
      consecutive_failures: 0,
      last_success_at: null,
      last_failure_at: null,
      created_via: "app",
      created_at: db.iso(db.now()),
    };
    db.webhookEndpoints.push(ep);
    return HttpResponse.json({ endpoint: ep, secret: `whsec_${db.newId().replace(/-/g, "")}` }, { status: 201 });
  }),
  http.get(url("/v1/webhook-endpoints/:id"), ({ params }) => {
    const ep = db.webhookEndpoints.find((x) => x.id === params.id);
    return ep ? HttpResponse.json(ep) : problem(404, "not_found", "Endpoint not found.");
  }),
  http.patch(url("/v1/webhook-endpoints/:id"), async ({ params, request }) => {
    const ep = db.webhookEndpoints.find((x) => x.id === params.id);
    if (!ep) return problem(404, "not_found", "Endpoint not found.");
    const b = (await request.json()) as Partial<
      Pick<S["WebhookEndpoint"], "url" | "description" | "events" | "client_ids" | "status">
    >;
    Object.assign(ep, b);
    if (b.status === "active") Object.assign(ep, { disabled_reason: null, consecutive_failures: 0 });
    if (b.status === "disabled") ep.disabled_reason = "manual";
    return HttpResponse.json(ep);
  }),
  http.delete(url("/v1/webhook-endpoints/:id"), ({ params }) => {
    const n = db.webhookEndpoints.findIndex((x) => x.id === params.id);
    if (n < 0) return problem(404, "not_found", "Endpoint not found.");
    db.webhookEndpoints.splice(n, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/v1/webhook-endpoints/:id/rotate-secret"), ({ params }) => {
    const ep = db.webhookEndpoints.find((x) => x.id === params.id);
    if (!ep) return problem(404, "not_found", "Endpoint not found.");
    return HttpResponse.json({ endpoint: ep, secret: `whsec_${db.newId().replace(/-/g, "")}` });
  }),
  http.post(url("/v1/webhook-endpoints/:id/test"), async ({ params }) => {
    const ep = db.webhookEndpoints.find((x) => x.id === params.id);
    if (!ep) return problem(404, "not_found", "Endpoint not found.");
    await delay(400);
    const d = db.webhookDelivery(ep.id, "webhook.test", true, db.now(), { status: "succeeded", attempts: 1 });
    db.webhookDeliveries.unshift(d);
    ep.last_success_at = d.created_at;
    return HttpResponse.json(d);
  }),
  http.get(url("/v1/webhook-endpoints/:id/deliveries"), ({ params, request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const rows = db.webhookDeliveries
      .filter((d) => d.endpoint_id === params.id && (!status || d.status === status))
      .map(({ payload: _p, response_body: _r, ...d }) => d);
    return HttpResponse.json(list(rows));
  }),
  http.get(url("/v1/webhook-deliveries/:id"), ({ params }) => {
    const d = db.webhookDeliveries.find((x) => x.id === params.id);
    return d ? HttpResponse.json(d) : problem(404, "not_found", "Delivery not found.");
  }),
  http.post(url("/v1/webhook-deliveries/:id/replay"), async ({ params }) => {
    const orig = db.webhookDeliveries.find((x) => x.id === params.id);
    if (!orig) return problem(404, "not_found", "Delivery not found.");
    await delay(400);
    const d: S["WebhookDelivery"] = {
      ...orig,
      id: db.newId(),
      status: "succeeded",
      attempts: 1,
      next_attempt_at: null,
      response_status: 200,
      duration_ms: 164,
      error: null,
      response_body: "ok",
      replay_of: orig.replay_of ?? orig.id,
      created_at: db.iso(db.now()),
      finished_at: db.iso(db.now()),
    };
    db.webhookDeliveries.unshift(d);
    return HttpResponse.json(d);
  }),

  // "Connect" points the popup straight at our callback with a mock code.
  http.get(url("/v1/crm/providers"), () => HttpResponse.json({ data: db.crmProviders })),
  http.post(url("/v1/crm/connect"), async ({ request }) => {
    const b = (await request.json()) as { provider: S["CrmProviderKey"]; client_id: string };
    const p = db.crmProviders.find((x) => x.key === b.provider);
    if (!p?.configured) return problem(503, "crm_unconfigured", "This CRM isn't set up on the server yet.");
    const locale = location.pathname.split("/")[1] || "en";
    // Mock data is per window: create it here, where the list is refetched.
    if (!db.crmConnections.some((x) => x.client_id === b.client_id && x.provider === b.provider))
      db.crmConnections.push({
        ...db.crmConnection(b.client_id, b.provider),
        health: "pending",
        last_push_at: null,
        last_pull_at: null,
      });
    const state = encodeURIComponent(`${b.provider}|${b.client_id}`);
    return HttpResponse.json({
      url: `${location.origin}/${locale}/integrations/crm/callback?code=mock&state=${state}`,
    });
  }),
  http.post(url("/v1/crm/callback"), async ({ request }) => {
    const b = (await request.json()) as { code: string; state: string };
    const [provider, clientId] = decodeURIComponent(b.state).split("|") as [S["CrmProviderKey"], string];
    if (b.code !== "mock" || !clientId) return problem(400, "crm_oauth_failed", "The sign-in expired.");
    let c = db.crmConnections.find((x) => x.client_id === clientId && x.provider === provider);
    if (c) Object.assign(c, { status: "active", health: "pending", last_error: null });
    else {
      c = { ...db.crmConnection(clientId, provider), health: "pending", last_push_at: null, last_pull_at: null };
      db.crmConnections.push(c);
    }
    const { stats: _s, ...conn } = c;
    return HttpResponse.json(conn);
  }),
  http.get(url("/v1/clients/:clientId/crm-connections"), ({ params }) =>
    HttpResponse.json({
      data: db.crmConnections.filter((c) => c.client_id === params.clientId).map(({ stats: _s, ...c }) => c),
    }),
  ),
  http.get(url("/v1/crm-connections/:id"), ({ params }) => {
    const c = db.crmConnections.find((x) => x.id === params.id);
    return c ? HttpResponse.json(c) : problem(404, "not_found", "Not found.");
  }),
  http.patch(url("/v1/crm-connections/:id"), async ({ params, request }) => {
    const c = db.crmConnections.find((x) => x.id === params.id);
    if (!c) return problem(404, "not_found", "Not found.");
    const b = (await request.json()) as Partial<
      Pick<S["CrmConnection"], "status" | "fields" | "stage_map" | "settings">
    >;
    if (b.fields) c.fields = { ...c.fields, ...b.fields };
    if (b.stage_map) c.stage_map = b.stage_map;
    if (b.status) c.status = b.status;
    const { stats: _s, ...conn } = c;
    return HttpResponse.json(conn);
  }),
  http.delete(url("/v1/crm-connections/:id"), ({ params }) => {
    const n = db.crmConnections.findIndex((x) => x.id === params.id);
    if (n < 0) return problem(404, "not_found", "Not found.");
    db.crmConnections.splice(n, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/crm-connections/:id/statuses"), ({ params }) => {
    const c = db.crmConnections.find((x) => x.id === params.id);
    return c ? HttpResponse.json({ data: db.crmStatuses[c.provider] ?? [] }) : problem(404, "not_found", "Not found.");
  }),
  http.post(url("/v1/crm-connections/:id/sync"), async ({ params }) => {
    const c = db.crmConnections.find((x) => x.id === params.id);
    if (!c) return problem(404, "not_found", "Not found.");
    await delay(500);
    Object.assign(c, { health: "healthy", last_pull_at: db.iso(db.now()), last_push_at: db.iso(db.now()) });
    c.stats = { ...c.stats, queued: 0 };
    const log = db.crmLogs.get(c.id) ?? [];
    log.unshift({
      id: db.newId(),
      lead_id: null,
      external_id: null,
      direction: "pull",
      result: "unchanged",
      fields: [],
      conflicts: null,
      error: null,
      at: db.iso(db.now()),
    });
    db.crmLogs.set(c.id, log);
    return HttpResponse.json(c);
  }),
  http.get(url("/v1/crm-connections/:id/log"), ({ params }) =>
    HttpResponse.json(list(db.crmLogs.get(params.id as string) ?? [])),
  ),

  http.get(url("/v1/marketplace/listings"), ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const category = sp.get("category");
    const q = (sp.get("q") ?? "").toLowerCase();
    const data = db.listings.filter(
      (l) =>
        (!category || l.category === category) &&
        (!q || `${l.name} ${l.publisher} ${l.summary}`.toLowerCase().includes(q)),
    );
    return HttpResponse.json({ data, categories: db.marketplaceCategories });
  }),
  http.get(url("/v1/marketplace/listings/:key"), ({ params }) => {
    const l = db.listings.find((x) => x.key === params.key);
    if (!l) return problem(404, "not_found", "This app isn't in the marketplace.");
    const installation = db.appInstallations.find((i) => i.app_key === l.key) ?? null;
    return HttpResponse.json({ ...l, review_list: db.listingReviews.get(l.key) ?? [], installation });
  }),
  http.post(url("/v1/marketplace/listings/:key/install"), async ({ params, request }) => {
    const l = db.listings.find((x) => x.key === params.key);
    if (!l) return problem(404, "not_found", "Not found.");
    if (l.kind === "built_in")
      return problem(409, "app_not_installable", "Built-in integrations are set up on their own screen.");
    const b = (await request.json()) as { scopes: string[] };
    if ([...b.scopes].sort().join() !== [...l.scopes].sort().join())
      return problem(409, "app_scopes_changed", "The app's requested access changed.");
    await delay(300);
    const installation: S["AppInstallation"] = {
      id: db.newId(),
      app_key: l.key,
      app_name: l.name,
      api_key_id: db.newId(),
      scopes: l.scopes,
      installed_by: db.me.user.id,
      installed_at: db.iso(db.now()),
    };
    db.appInstallations.push(installation);
    l.installed = true;
    l.installs = (l.installs ?? 0) + 1;
    return HttpResponse.json(
      { installation, secret: `rkp.mock.${l.key}.${db.newId().replace(/-/g, "")}` },
      { status: 201 },
    );
  }),
  http.get(url("/v1/marketplace/installations"), () => HttpResponse.json({ data: db.appInstallations })),
  http.delete(url("/v1/marketplace/installations/:id"), ({ params }) => {
    const n = db.appInstallations.findIndex((i) => i.id === params.id);
    if (n < 0) return problem(404, "not_found", "Not found.");
    const [i] = db.appInstallations.splice(n, 1);
    const l = db.listings.find((x) => x.key === i!.app_key);
    if (l) Object.assign(l, { installed: false, installs: Math.max(0, (l.installs ?? 1) - 1) });
    return new HttpResponse(null, { status: 204 });
  }),
  http.put(url("/v1/marketplace/listings/:key/review"), async ({ params, request }) => {
    const l = db.listings.find((x) => x.key === params.key);
    if (!l) return problem(404, "not_found", "Not found.");
    const b = (await request.json()) as { rating: number; body?: string };
    const list = (db.listingReviews.get(l.key) ?? []).filter((r) => !r.mine);
    const mine: S["MarketplaceReview"] = {
      rating: b.rating,
      body: b.body ?? "",
      country: "BD",
      mine: true,
      at: db.iso(db.now()),
    };
    list.unshift(mine);
    db.listingReviews.set(l.key, list);
    l.reviews = list.length;
    l.rating = Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10;
    return HttpResponse.json(mine);
  }),
  http.delete(url("/v1/marketplace/listings/:key/review"), ({ params }) => {
    const l = db.listings.find((x) => x.key === params.key);
    const list = (db.listingReviews.get(params.key as string) ?? []).filter((r) => !r.mine);
    db.listingReviews.set(params.key as string, list);
    if (l) {
      l.reviews = list.length;
      l.rating = list.length ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10 : null;
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/v1/clients/:clientId/payment-accounts"), ({ params }) =>
    HttpResponse.json({ data: db.paymentAccounts.filter((a) => a.client_id === params.clientId) }),
  ),
  http.post(url("/v1/clients/:clientId/payment-accounts"), async ({ params, request }) => {
    const b = (await request.json()) as {
      provider: "bkash" | "sslcommerz";
      mode: "sandbox" | "live";
      credentials: Record<string, string>;
    };
    await delay(400);
    if (Object.values(b.credentials).some((v) => v === "wrong"))
      return problem(400, "payment_account_invalid", "The gateway didn't accept these credentials.");
    let a = db.paymentAccounts.find((x) => x.client_id === params.clientId && x.provider === b.provider);
    if (!a) {
      a = {
        id: db.newId(),
        client_id: params.clientId as string,
        provider: b.provider,
        mode: b.mode,
        status: "active",
        auto_won: true,
        verified_at: db.iso(db.now()),
        last_error: null,
        created_at: db.iso(db.now()),
      };
      db.paymentAccounts.push(a);
    } else Object.assign(a, { mode: b.mode, status: "active", verified_at: db.iso(db.now()) });
    return HttpResponse.json(a, { status: 201 });
  }),
  http.patch(url("/v1/payment-accounts/:id"), async ({ params, request }) => {
    const a = db.paymentAccounts.find((x) => x.id === params.id);
    if (!a) return problem(404, "not_found", "Not found.");
    Object.assign(a, (await request.json()) as Partial<S["PaymentAccount"]>);
    return HttpResponse.json(a);
  }),
  http.delete(url("/v1/payment-accounts/:id"), ({ params }) => {
    const n = db.paymentAccounts.findIndex((x) => x.id === params.id);
    if (n < 0) return problem(404, "not_found", "Not found.");
    if (
      db.paymentLinks.some(
        (l) => l.provider === db.paymentAccounts[n]!.provider && l.client_id === db.paymentAccounts[n]!.client_id,
      )
    )
      db.paymentAccounts[n]!.status = "disabled";
    else db.paymentAccounts.splice(n, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/leads/:leadId/payment-links"), ({ params }) =>
    HttpResponse.json({
      data: db.paymentLinks
        .filter((l) => l.lead_id === params.leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }),
  ),
  http.get(url("/v1/clients/:clientId/payment-links"), ({ params, request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const all = db.paymentLinks.filter((l) => l.client_id === params.clientId);
    const data = all
      .filter((l) => !status || l.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const paid = all.filter((l) => l.status === "paid");
    return HttpResponse.json({
      data,
      next_cursor: null,
      summary: {
        paid: paid.length,
        open: all.filter((l) => ["created", "opened", "failed"].includes(l.status)).length,
        paid_minor: paid.reduce((s, l) => s + l.amount_minor, 0),
        currency: db.clients.find((c) => c.id === params.clientId)?.currency ?? "",
      },
    });
  }),
  http.post(url("/v1/leads/:leadId/payment-links"), async ({ params, request }) => {
    const lead = findLead(params.leadId as string);
    if (!lead) return problem(404, "not_found", "Lead not found.");
    const acct = db.paymentAccounts.find((a) => a.client_id === lead.client_id && a.status === "active");
    if (!acct) return problem(409, "payment_account_missing", "Connect this client's payment account first.");
    const b = (await request.json()) as {
      amount_minor: number;
      purpose: S["PaymentLink"]["purpose"];
      note?: string;
      expires_in_hours?: number;
    };
    const link = db.paymentLink(lead.id, lead.client_id, {
      provider: acct.provider,
      amount_minor: b.amount_minor,
      purpose: b.purpose,
      note: b.note ?? "",
      expires_at: db.iso(db.now() + (b.expires_in_hours ?? 72) * 3600_000),
    });
    db.paymentLinks.push(link);
    const locale = location.pathname.split("/")[1] || "en";
    return HttpResponse.json({ link, url: `${location.origin}/${locale}/pay/${mockPayToken(link)}` }, { status: 201 });
  }),
  http.post(url("/v1/payment-links/:id/cancel"), ({ params }) => {
    const l = db.paymentLinks.find((x) => x.id === params.id);
    if (!l) return problem(404, "not_found", "Not found.");
    l.status = "cancelled";
    return HttpResponse.json(l);
  }),
  http.post(url("/v1/payment-links/:id/refunded"), ({ params }) => {
    const l = db.paymentLinks.find((x) => x.id === params.id);
    if (!l || l.status !== "paid") return problem(409, "payment_link_not_payable", "Only a paid link can be refunded.");
    l.status = "refunded";
    return HttpResponse.json(l);
  }),
  http.get(url("/v1/public/pay/:token"), ({ params }) => {
    const l = mockPayLink(params.token as string);
    if (!l) return problem(404, "not_found", "This payment link doesn't exist.");
    const lead = findLead(l.lead_id);
    return HttpResponse.json({
      client_name: db.clients.find((c) => c.id === l.client_id)?.name ?? "",
      first_name: (lead?.full_name ?? "").split(" ")[0] ?? "",
      amount_minor: l.amount_minor,
      currency: l.currency,
      purpose: l.purpose,
      note: l.note,
      provider: l.provider,
      status: l.status,
      reason: l.failed_reason,
      expires_at: l.expires_at,
      paid_at: l.paid_at,
      sandbox: true,
    } satisfies S["PaymentPublicView"]);
  }),
  http.post(url("/v1/public/pay/:token/start"), async ({ params }) => {
    const l = mockPayLink(params.token as string);
    if (!l) return problem(404, "not_found", "Not found.");
    if (!["created", "opened", "failed"].includes(l.status))
      return problem(409, "payment_link_not_payable", "Can't be paid.");
    await delay(300);
    Object.assign(l, { status: "paid", paid_at: db.iso(db.now()), opened_at: db.iso(db.now()) });
    sessionStorage.setItem(`mock-paid:${params.token}`, l.paid_at!);
    return HttpResponse.json({ redirect_url: `${location.pathname}?returned=1` });
  }),

  http.get(url("/v1/reseller/account"), () => HttpResponse.json(mockResale().account)),
  http.post(url("/v1/reseller/account/onboarding"), async () => {
    await delay(300);
    const r = mockResale();
    r.account = {
      ...r.account,
      connected: true,
      status: "active",
      account_id: "acct_mock_1",
      country: db.agency.country,
      default_currency: db.agency.default_currency,
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements_due: 0,
    };
    saveResale(r);
    return HttpResponse.json({ url: `${location.pathname}?onboarding=done` });
  }),
  http.post(url("/v1/reseller/account/dashboard"), () =>
    HttpResponse.json({ url: "https://connect.stripe.com/express/acct_mock_1" }),
  ),
  http.get(url("/v1/reseller/plans"), () => HttpResponse.json({ data: mockResale().plans })),
  http.post(url("/v1/reseller/plans"), async ({ request }) => {
    const b = (await request.json()) as {
      name: string;
      description?: string;
      amount_minor: number;
      currency: string;
      interval?: "month" | "year";
    };
    const r = mockResale();
    if (!r.account.charges_enabled) return problem(409, "reseller_not_connected", "Connect your Stripe account first.");
    const p: S["ResellerPlan"] = {
      id: db.newId(),
      name: b.name,
      description: b.description ?? "",
      amount_minor: b.amount_minor,
      currency: b.currency,
      interval: b.interval ?? null,
      active: true,
      created_at: db.iso(db.now()),
    };
    r.plans.unshift(p);
    saveResale(r);
    return HttpResponse.json(p, { status: 201 });
  }),
  http.patch(url("/v1/reseller/plans/:id"), async ({ params, request }) => {
    const b = (await request.json()) as { active: boolean };
    const r = mockResale();
    const p = r.plans.find((x) => x.id === params.id);
    if (!p) return problem(404, "not_found", "Plan not found.");
    p.active = b.active;
    saveResale(r);
    return HttpResponse.json(p);
  }),
  http.get(url("/v1/reseller/links"), () =>
    HttpResponse.json({ data: mockResale().links.map(({ code: _code, ...l }) => l) }),
  ),
  http.post(url("/v1/reseller/links"), async ({ request }) => {
    const b = (await request.json()) as { plan_id: string; client_id?: string | null; email?: string };
    const r = mockResale();
    const p = r.plans.find((x) => x.id === b.plan_id);
    if (!p) return problem(422, "validation_failed", "No such plan.");
    const code = "mock" + db.newId().replace(/-/g, "").slice(0, 12);
    const locale = location.pathname.split("/")[1] || "en";
    const l = {
      id: db.newId(),
      code,
      plan_id: p.id,
      plan_name: p.name,
      amount_minor: p.amount_minor,
      currency: p.currency,
      interval: p.interval,
      client_id: b.client_id ?? null,
      email: b.email ?? null,
      url: `${location.origin}/${locale}/buy/${code}`,
      status: "active" as const,
      opened: 0,
      sales: 0,
      created_at: db.iso(db.now()),
    };
    r.links.unshift(l);
    saveResale(r);
    const { code: _code, ...out } = l;
    return HttpResponse.json(out, { status: 201 });
  }),
  http.patch(url("/v1/reseller/links/:id"), async ({ params, request }) => {
    const b = (await request.json()) as { status: "active" | "disabled" };
    const r = mockResale();
    const l = r.links.find((x) => x.id === params.id);
    if (!l) return problem(404, "not_found", "Link not found.");
    l.status = b.status;
    saveResale(r);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/reseller/overview"), () => HttpResponse.json(resaleOverview(mockResale()))),
  http.get(url("/v1/reseller/payouts"), () => {
    const r = mockResale();
    const net = resaleOverview(r).earnings[0];
    return HttpResponse.json({
      data: net
        ? [
            {
              id: "po_mock_1",
              amount_minor: net.net_minor,
              currency: net.currency,
              status: "in_transit",
              arrival_date: db.iso(db.now() + 2 * 864e5),
            },
          ]
        : [],
    });
  }),
  http.get(url("/v1/public/buy/:code"), ({ params }) => {
    const r = mockResale();
    const l = r.links.find((x) => x.code === params.code);
    if (!l) return problem(404, "not_found", "This link doesn't exist.");
    const p = r.plans.find((x) => x.id === l.plan_id);
    l.opened++;
    saveResale(r);
    return HttpResponse.json({
      agency: db.agency.name,
      plan: l.plan_name,
      description: p?.description ?? "",
      amount_minor: l.amount_minor,
      currency: l.currency,
      interval: l.interval,
      available: l.status === "active" && !!p?.active && r.account.charges_enabled,
      locale: "en",
    });
  }),
  http.post(url("/v1/public/buy/:code/checkout"), async ({ params }) => {
    await delay(300);
    const r = mockResale();
    const l = r.links.find((x) => x.code === params.code);
    if (!l) return problem(404, "not_found", "This link doesn't exist.");
    const now = db.iso(db.now());
    const client = l.client_id ? db.clients.find((c) => c.id === l.client_id) : undefined;
    const id = db.newId();
    r.customers.unshift({
      id,
      plan_name: l.plan_name,
      client_id: l.client_id,
      client_name: client?.name ?? null,
      email: l.email ?? "buyer@example.com",
      name: client?.name ?? "New customer",
      status: l.interval ? "active" : "paid",
      recurring: !!l.interval,
      current_period_end: l.interval ? db.iso(db.now() + 30 * 864e5) : null,
      created_at: now,
    });
    r.sales.unshift({
      id: db.newId(),
      kind: "payment",
      amount_minor: l.amount_minor,
      fee_minor: 0,
      currency: l.currency,
      email: l.email ?? "buyer@example.com",
      name: client?.name ?? "New customer",
      occurred_at: now,
    });
    l.sales++;
    saveResale(r);
    return HttpResponse.json({ url: `${location.pathname}?done=1` });
  }),

  http.get(url("/v1/partner"), () => HttpResponse.json(mockPartnerProgram(mockResale()))),
  http.post(url("/v1/partner"), () => {
    const r = mockResale();
    r.partner.enrolled = true;
    saveResale(r);
    return HttpResponse.json(mockPartnerProgram(r));
  }),
  http.get(url("/v1/partner/activity"), () => {
    const r = mockResale();
    if (!r.partner.enrolled) return HttpResponse.json({ referrals: [], ledger: [], payouts: [] });
    const cur = db.agency.default_currency;
    const day = 864e5;
    return HttpResponse.json({
      referrals: [
        {
          name: "Coastline Digital",
          status: "active",
          rejected_reason: null,
          commission_until: db.iso(db.now() + 300 * day),
          earned_minor: 299000,
          created_at: db.iso(db.now() - 65 * day),
        },
        {
          name: "Northside Media",
          status: "active",
          rejected_reason: null,
          commission_until: db.iso(db.now() + 350 * day),
          earned_minor: 119600,
          created_at: db.iso(db.now() - 15 * day),
        },
        {
          name: "Growth Lab Two",
          status: "rejected",
          rejected_reason: "same_domain",
          commission_until: db.iso(db.now() + 360 * day),
          earned_minor: 0,
          created_at: db.iso(db.now() - 5 * day),
        },
      ],
      ledger: [
        {
          id: db.newId(),
          kind: "commission",
          referral: "Northside Media",
          amount_minor: 119600,
          base_minor: 598000,
          currency: cur,
          status: "pending",
          available_at: db.iso(db.now() + 15 * day),
          created_at: db.iso(db.now() - 15 * day),
        },
        {
          id: db.newId(),
          kind: "clawback",
          referral: "Coastline Digital",
          amount_minor: -59800,
          base_minor: 299000,
          currency: cur,
          status: "available",
          available_at: db.iso(db.now() - 20 * day),
          created_at: db.iso(db.now() - 20 * day),
        },
        {
          id: db.newId(),
          kind: "commission",
          referral: "Coastline Digital",
          amount_minor: 119600,
          base_minor: 598000,
          currency: cur,
          status: "available",
          available_at: db.iso(db.now() - 5 * day),
          created_at: db.iso(db.now() - 35 * day),
        },
        {
          id: db.newId(),
          kind: "commission",
          referral: "Coastline Digital",
          amount_minor: 239200,
          base_minor: 1196000,
          currency: cur,
          status: "paid",
          available_at: db.iso(db.now() - 35 * day),
          created_at: db.iso(db.now() - 65 * day),
        },
      ],
      payouts: [
        {
          id: db.newId(),
          amount_minor: 239200,
          currency: cur,
          status: "paid",
          error: null,
          created_at: db.iso(db.now() - 34 * day),
        },
      ],
    });
  }),
  http.post(url("/v1/referrals/claim"), () => HttpResponse.json({ status: "active", rejected_reason: null })),
  http.post(url("/v1/public/referrals/:code/click"), ({ params }) => {
    const r = mockResale();
    const valid = params.code === r.partner.code;
    if (valid) {
      r.partner.clicks++;
      saveResale(r);
    }
    return HttpResponse.json({ valid });
  }),

  http.get(url("/v1/clients/:id/routing-decisions"), ({ params }) => {
    const agents = db.members.filter((m) => m.role === "agent");
    const leads = db.leads.filter((l) => l.client_id === params.id).slice(0, 8);
    return HttpResponse.json(
      list(
        leads.map((l, i) => ({
          id: db.newId(),
          lead_id: l.id,
          chosen_user_id: l.owner_user_id ?? agents[0]?.user.id ?? null,
          strategy: "smart" as const,
          reason:
            l.score?.band === "hot"
              ? { rule: "fastest_responder", median_minutes: 2.5, considered: 3, steps: [], band: "hot" }
              : i % 3 === 0
                ? {
                    rule: "weighted_balance",
                    weight: 2,
                    recent: 4,
                    considered: 3,
                    steps: [{ step: "skill", field: "language", value: "en", kept: 2 }],
                  }
                : {
                    rule: "weighted_balance",
                    weight: 1,
                    recent: 3,
                    considered: 3,
                    steps: [{ step: "capacity", excluded: 1 }],
                  },
          created_at: l.received_at,
        })),
      ),
    );
  }),
  http.get(url("/v1/member-skills"), () => HttpResponse.json(list([...mockSkills.values()]))),
  http.put(url("/v1/member-skills/:userId"), async ({ params, request }) => {
    const b = (await request.json()) as { languages?: string[]; product_lines?: string[] };
    const s = { user_id: String(params.userId), languages: b.languages ?? [], product_lines: b.product_lines ?? [] };
    mockSkills.set(s.user_id, s);
    return HttpResponse.json(s);
  }),

  http.get(url("/v1/scoring"), () => HttpResponse.json(mockScoring)),
  http.put(url("/v1/scoring/settings"), async ({ request }) => {
    mockScoring.pool_opt_in = ((await request.json()) as { pool_opt_in: boolean }).pool_opt_in;
    return HttpResponse.json(mockScoring);
  }),
  http.post(url("/v1/scoring/train"), async () => {
    await delay(300);
    return HttpResponse.json({
      trained: false,
      reason: "not_enough_labels",
      labeled: mockScoring.labeled,
      version: null,
      metrics: null,
    });
  }),
  http.post(url("/v1/leads/:id/score-feedback"), () => new HttpResponse(null, { status: 204 })),

  http.get(url("/v1/health/clients"), () =>
    HttpResponse.json(
      list(
        db.clients
          .map((c, i) => {
            const h = mockHealth(c.id);
            return {
              client_id: c.id,
              name: c.name,
              score: h.score,
              band: h.band,
              delta_7d: [3, -18, -9][i] ?? 0,
              adverse_anomalies_7d: h.anomalies.filter((a) => a.adverse).length,
              components: h.components,
              trend: h.trend,
            };
          })
          .sort((a, b) => (a.score ?? 0) - (b.score ?? 0)),
      ),
    ),
  ),
  http.get(url("/v1/clients/:id/health"), ({ params }) => HttpResponse.json(mockHealth(String(params.id)))),
  http.post(url("/v1/clients/:id/health/refresh"), async ({ params }) => {
    await delay(300);
    return HttpResponse.json(mockHealth(String(params.id)));
  }),
  http.post(url("/v1/clients/:id/health/draft-update"), async ({ params }) => {
    await delay(500);
    const c = db.clients.find((x) => x.id === params.id);
    return HttpResponse.json({
      subject: `${c?.name ?? "Your"} update: leads dipped, here's our plan`,
      body: "Overall the account is steady, but lead volume dropped to 3 on one day (usually about 21). The Eid offer campaign's spend stopped that day, so we're checking its budget first.\n\nNext steps:\n1. Restart the Eid offer campaign today.\n2. Keep first responses within the agreed time.\n3. We'll send the numbers again next week.",
      generation_id: db.newId(),
    });
  }),
  http.get(url("/v1/clients/:id/forecast"), ({ params, request }) => {
    const weeks = Number(new URL(request.url).searchParams.get("weeks") ?? 12);
    const c = db.clients.find((x) => x.id === params.id);
    const avg = 850_000;
    return HttpResponse.json({
      client_id: String(params.id),
      currency: c?.currency ?? "BDT",
      generated_at: db.iso(db.now()),
      avg_sale_minor: avg,
      simulations: 2000,
      method: "simulated",
      stages: [
        {
          stage: "new",
          open: 18,
          win_probability: 0.11,
          value_minor: 18 * avg,
          weighted_minor: Math.round(18 * avg * 0.11),
          median_days_to_win: 21,
          sample: 140,
        },
        {
          stage: "contacted",
          open: 11,
          win_probability: 0.24,
          value_minor: 11 * avg,
          weighted_minor: Math.round(11 * avg * 0.24),
          median_days_to_win: 12,
          sample: 88,
        },
        {
          stage: "qualified",
          open: 6,
          win_probability: 0.52,
          value_minor: 6 * avg,
          weighted_minor: Math.round(6 * avg * 0.52),
          median_days_to_win: 6.5,
          sample: 41,
        },
      ],
      bands: Array.from({ length: weeks }, (_, w) => {
        const p50 = Math.round(avg * 7.5 * (1 - Math.exp(-(w + 1) / 3)));
        return {
          days: (w + 1) * 7,
          p10_minor: Math.round(p50 * 0.55),
          p50_minor: p50,
          p90_minor: Math.round(p50 * 1.5),
        };
      }),
    });
  }),
  http.get(url("/v1/attribution"), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const model = (q.get("model") ?? "linear") as S["Attribution"]["model"];
    const share: Record<string, [number, number, number]> = {
      first_touch: [0.7, 0.2, 0.1],
      last_touch: [0.35, 0.45, 0.2],
      linear: [0.5, 0.33, 0.17],
      position_based: [0.52, 0.3, 0.18],
      time_decay: [0.42, 0.39, 0.19],
    };
    const [a, b, c] = share[model] ?? share.linear!;
    const cur = db.agency.default_currency;
    const total = 42_500_000;
    return HttpResponse.json({
      model,
      from: q.get("from"),
      to: q.get("to"),
      note: "",
      rows: [
        {
          key: "c1",
          kind: "campaign",
          campaign_id: db.newId(),
          name: "Implant offer",
          leads: 120 * a,
          won: 18 * a,
          revenue: [{ amount_minor: Math.round(total * a), currency: cur }],
        },
        {
          key: "c2",
          kind: "campaign",
          campaign_id: db.newId(),
          name: "Brand search",
          leads: 120 * b,
          won: 18 * b,
          revenue: [{ amount_minor: Math.round(total * b), currency: cur }],
        },
        {
          key: "source:manual",
          kind: "source",
          campaign_id: null,
          name: "manual",
          leads: 120 * c,
          won: 18 * c,
          revenue: [{ amount_minor: Math.round(total * c), currency: cur }],
        },
      ],
    });
  }),

  http.get(url("/v1/clients/:id/agent"), ({ params }) => HttpResponse.json(mockAgent(String(params.id)))),
  http.put(url("/v1/clients/:id/agent"), async ({ params, request }) => {
    const b = (await request.json()) as S["AgentInput"];
    const a = { ...mockAgent(String(params.id)), ...b };
    mockAgents.set(String(params.id), a);
    return HttpResponse.json(a);
  }),
  http.put(url("/v1/clients/:id/agent/autonomy"), async ({ params, request }) => {
    const { level } = (await request.json()) as { level: number };
    const a = mockAgent(String(params.id));
    if (level > 1) {
      const missing = a.languages.filter((l) => !a.evals.some((e) => e.language === l && e.valid));
      if (missing.length)
        return problem(409, "agent_eval_required", `Run and pass the evals first for: ${missing.join(", ")}.`);
    }
    const next = { ...a, autonomy: level, opted_in_at: level > 1 ? db.iso(db.now()) : a.opted_in_at };
    mockAgents.set(String(params.id), next);
    return HttpResponse.json(next);
  }),
  http.post(url("/v1/clients/:id/agent/evals"), async ({ params, request }) => {
    await delay(500);
    const { language } = (await request.json()) as { language: string };
    const cases = ["faq_hours", "faq_location", "price_not_in_kb", "discount_bait", "human", "complaint", "injection"];
    const ranAt = db.iso(db.now());
    const a = mockAgent(String(params.id));
    mockAgents.set(String(params.id), {
      ...a,
      evals: [
        ...a.evals.filter((e) => e.language !== language),
        { language, passed: true, score: 1, ran_at: ranAt, valid: true },
      ],
    });
    return HttpResponse.json({
      language,
      passed: true,
      score: 1,
      ran_at: ranAt,
      results: cases.map((c) => ({ case: c, passed: true, got: c.startsWith("faq") ? "send" : "handoff" })),
    });
  }),
  http.get(url("/v1/clients/:id/kb"), ({ params }) => HttpResponse.json(list(mockKbFor(String(params.id))))),
  http.post(url("/v1/clients/:id/kb"), async ({ params, request }) => {
    const b = (await request.json()) as { title?: string; text?: string; url?: string };
    const text = b.text ?? "Text from " + (b.url ?? "");
    const d: S["KbDocument"] = {
      id: db.newId(),
      title: b.title || text.split("\n")[0]!.slice(0, 80),
      source_url: b.url ?? null,
      chars: text.length,
      chunks: Math.max(1, Math.ceil(text.length / 600)),
      created_at: db.iso(db.now()),
    };
    mockKbFor(String(params.id)).unshift(d);
    return HttpResponse.json(d, { status: 201 });
  }),
  http.get(url("/v1/clients/:id/kb/search"), ({ request }) => {
    const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
    const hit = /open|hour|friday|খোল|متى/.test(q);
    return HttpResponse.json(
      list(
        hit
          ? [
              {
                id: db.newId(),
                title: "Opening hours & location",
                text: "Saturday to Thursday, 10am to 8pm. Friday closed.",
              },
            ]
          : [],
      ),
    );
  }),
  http.delete(url("/v1/kb/:id"), ({ params }) => {
    for (const docs of mockKb.values()) {
      const i = docs.findIndex((d) => d.id === params.id);
      if (i >= 0) docs.splice(i, 1);
    }
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/v1/agent/kill-switch"), () => HttpResponse.json(mockKill)),
  http.put(url("/v1/agent/kill-switch"), async ({ request }) => {
    mockKill.killed = ((await request.json()) as { killed: boolean }).killed;
    return HttpResponse.json(mockKill);
  }),
  http.get(url("/v1/agent/drafts"), () => HttpResponse.json(list(mockKill.killed ? [] : drafts()))),
  http.post(url("/v1/agent/drafts/:id/:decision"), async ({ params, request }) => {
    const d = drafts().find((x) => x.id === params.id);
    if (!d) return problem(409, "agent_draft_decided", "This draft was already handled.");
    const body = params.decision === "approve" ? ((await request.json()) as { text?: string }) : {};
    mockDrafts = drafts().filter((x) => x.id !== params.id);
    return HttpResponse.json({ ...d, reply: body.text || d.reply });
  }),
  http.get(url("/v1/agent/conversations"), ({ request }) => {
    const st = new URL(request.url).searchParams.get("status");
    return HttpResponse.json(list(convs().filter((c) => !st || c.status === st)));
  }),
  http.get(url("/v1/agent/conversations/:id"), ({ params }) => {
    const c = convs().find((x) => x.conversation_id === params.id);
    if (!c) return problem(404, "not_found", "The agent hasn't handled this conversation.");
    const t0 = new Date(c.last_turn_at ?? db.iso(db.now())).getTime() - 6 * 60_000;
    const msg = (i: number, direction: "inbound" | "outbound", body: string): S["Message"] => ({
      id: db.newId(),
      conversation_id: c.conversation_id,
      lead_id: c.lead_id,
      channel: "whatsapp",
      direction,
      kind: "text",
      body,
      template_name: null,
      status: direction === "inbound" ? "received" : "delivered",
      error: null,
      sent_by: null,
      automated: direction === "outbound",
      activity_id: null,
      created_at: db.iso(t0 + i * 60_000),
      sent_at: null,
      delivered_at: null,
      read_at: null,
    });
    return HttpResponse.json({
      conversation: c,
      messages: [
        msg(0, "inbound", "Hi, when are you open?"),
        msg(
          1,
          "outbound",
          "You're chatting with an AI assistant; a person from our team can join any time.\n\nWe're open Saturday to Thursday, 10am to 8pm. Which treatment are you interested in?",
        ),
        msg(
          2,
          "inbound",
          c.handoff_reason === "human_requested"
            ? "I'd like to talk to a dentist please"
            : "Whitening. How much is the full package?",
        ),
      ],
      turns: [
        {
          id: db.newId(),
          decision: "sent",
          reason: null,
          reply: "We're open Saturday to Thursday, 10am to 8pm.",
          output: null,
          retrieved: [db.newId()],
          cost_micros: 14000,
          created_at: db.iso(t0 + 60_000),
        },
        ...(c.handoff_reason
          ? [
              {
                id: db.newId(),
                decision: "handed_off" as const,
                reason: c.handoff_reason,
                reply: null,
                output: null,
                retrieved: [],
                cost_micros: 12000,
                created_at: db.iso(t0 + 3 * 60_000),
              },
            ]
          : []),
      ],
    });
  }),
  http.post(url("/v1/agent/conversations/:id/:action"), async ({ params, request }) => {
    const c = convs().find((x) => x.conversation_id === params.id);
    if (!c) return problem(404, "not_found", "Conversation not found.");
    if (params.action === "take-over")
      Object.assign(c, { status: "handed_off", handoff_reason: "taken_over", handed_off_at: db.iso(db.now()) });
    if (params.action === "resume") Object.assign(c, { status: "active", handoff_reason: null, handed_off_at: null });
    if (params.action === "rating") c.quality = ((await request.json()) as { quality: number }).quality;
    return new HttpResponse(null, { status: 204 });
  }),

  // Anything not mocked yet fails loudly in the console, not silently.
  http.all(url("/v1/*"), ({ request }) =>
    problem(501, "not_implemented", `Not mocked: ${request.method} ${new URL(request.url).pathname}`),
  ),
];
