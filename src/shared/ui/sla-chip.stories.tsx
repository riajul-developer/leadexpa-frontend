import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { SlaInput } from "../lib/sla";

import { QualityBadge, SourceBadge, STAGES, StageBadge, type SourceKind } from "./badges";
import { SlaChip } from "./sla-chip";

const MIN = 60_000;
const at = (offsetMin: number) => new Date(Date.now() + offsetMin * MIN).toISOString();

const STATES: Record<string, SlaInput> = {
  on_track: {
    sla: { status: "on_track", due_at: at(12), kind: "first_response" },
    received_at: at(-3),
    first_response_at: null,
    next_callback_at: null,
    stage: "new",
  },
  due_soon: {
    sla: { status: "due_soon", due_at: at(3), kind: "first_response" },
    received_at: at(-12),
    first_response_at: null,
    next_callback_at: null,
    stage: "new",
  },
  overdue: {
    sla: { status: "overdue", due_at: at(-18), kind: "first_response" },
    received_at: at(-33),
    first_response_at: null,
    next_callback_at: null,
    stage: "new",
  },
  met: {
    sla: { status: "met", due_at: null, kind: "first_response" },
    received_at: at(-60),
    first_response_at: at(-56),
    next_callback_at: null,
    stage: "contacted",
  },
  paused: {
    sla: { status: "met", due_at: null, kind: "first_response" },
    received_at: at(-60),
    first_response_at: at(-50),
    next_callback_at: at(150),
    stage: "contacted",
  },
};

const meta = {
  title: "Leads/SlaChip",
  component: SlaChip,
  args: { lead: STATES.on_track!, timeZone: "Asia/Dhaka" },
} satisfies Meta<typeof SlaChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {};
export const DueSoon: Story = { args: { lead: STATES.due_soon! } };
export const Overdue: Story = { args: { lead: STATES.overdue! } };
export const Met: Story = { args: { lead: STATES.met! } };
export const Paused: Story = { args: { lead: STATES.paused! } };

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(STATES).map(([k, lead]) => (
        <SlaChip key={k} lead={lead} timeZone="Asia/Dhaka" />
      ))}
    </div>
  ),
};

export const StageBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {STAGES.map((s) => (
        <StageBadge key={s} stage={s} />
      ))}
    </div>
  ),
};

export const SourceBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["meta_lead_ads", "web_form", "csv", "manual", "api"] as SourceKind[]).map((k) => (
        <SourceBadge key={k} kind={k} />
      ))}
      <SourceBadge kind="meta_lead_ads" label="Eid Implant Offer — Dhaka Dental Care (very long campaign name)" />
    </div>
  ),
};

export const QualityBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <QualityBadge quality={{ status: "valid", reasons: [], verified_at: new Date().toISOString() }} />
      <QualityBadge quality={{ status: "suspect", reasons: ["garbage_name", "disposable_email"], verified_at: null }} />
      <QualityBadge quality={{ status: "junk", reasons: ["phone_pattern"], verified_at: null }} />
    </div>
  ),
};
