import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { leads } from "@/mocks/db";

import { LeadCard } from "./lead-card";
import { LeadsTable } from "./leads-table";
import { OutcomeSheet } from "./outcome-sheet";
import { Timeline } from "./timeline";

const byState = (pred: (l: (typeof leads)[number]) => boolean) => leads.find(pred) ?? leads[0]!;
const overdue = byState((l) => l.sla?.status === "overdue");
const dueSoon = byState((l) => l.sla?.status === "due_soon");
const contacted = byState((l) => l.stage === "contacted" && !!l.first_response_at);
const unnamed = { ...overdue, id: `${overdue.id}-x`, full_name: "" };
const longBangla = { ...dueSoon, full_name: "মোছাম্মৎ শাহনাজ পারভীন চৌধুরী (ধানমন্ডি শাখা, ইমপ্লান্ট অফার)" };

const meta = {
  title: "Leads/LeadCard",
  component: LeadCard,
  args: { lead: overdue, onOpen: fn(), onOutcome: fn() },
  decorators: [
    (Story) => (
      <div className="border-border max-w-xl border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeadCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overdue: Story = {};
export const DueSoon: Story = { args: { lead: dueSoon } };
export const Contacted: Story = { args: { lead: contacted } };
export const Selected: Story = { args: { selected: true } };
export const KeyboardFocused: Story = { args: { focused: true } };
export const NoName: Story = { args: { lead: unnamed } };
export const LongBanglaName: Story = { args: { lead: longBangla } };
export const WithHint: Story = {
  args: { hint: <p className="text-muted text-xs">Asked about the Eid price twice — mention the offer.</p> },
};

export const InboxList: Story = {
  render: (args) => (
    <>
      {leads.slice(0, 8).map((l) => (
        <LeadCard key={l.id} {...args} lead={l} />
      ))}
    </>
  ),
};

export const Outcome: StoryObj<typeof OutcomeSheet> = {
  render: () => <OutcomeSheet lead={overdue} channel="call" onClose={fn()} />,
};

export const OutcomeAfterWhatsApp: StoryObj<typeof OutcomeSheet> = {
  render: () => <OutcomeSheet lead={overdue} channel="whatsapp" onClose={fn()} />,
};

export const LeadTimeline: StoryObj<typeof Timeline> = {
  name: "Timeline",
  render: () => (
    <div className="max-w-xl">
      <Timeline lead={contacted} timeZone="Asia/Dhaka" />
    </div>
  ),
};

export const Table: Story = {
  parameters: { nextjs: { navigation: { pathname: "/bn/leads" } } },
  render: () => <LeadsTable />,
};
