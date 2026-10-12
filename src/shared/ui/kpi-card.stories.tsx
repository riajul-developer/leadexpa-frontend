import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KpiCard } from "./kpi-card";

const meta = {
  title: "Dashboard/KpiCard",
  component: KpiCard,
  args: {
    label: "SLA মেনে উত্তর",
    value: "৮৭%",
    secondary: "১৭৪ / ২০০ লিড",
    definition: "Leads whose first response was within the SLA ÷ leads with a first-response SLA in the period.",
    trend: { direction: "up", good: true },
    trendLabel: "+৬ pts vs last week",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const BadTrend: Story = {
  args: {
    label: "Median first response",
    value: "23m",
    trend: { direction: "up", good: false },
    trendLabel: "+9m vs last week",
  },
};
export const WithFootnote: Story = { args: { footnote: "Excludes leads outside business hours." } };
export const Loading: Story = { args: { loading: true } };
