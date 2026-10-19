import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { recovered, sequences } from "@/mocks/db";

import { RecoveredView } from "./recovered-card";
import { SequenceEditor } from "./sequence-editor";

const meta = {
  title: "Sequences/Editor",
  component: SequenceEditor,
  args: { sequence: sequences[0] },
} satisfies Meta<typeof SequenceEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditRunningSequence: Story = {};

export const NewSequence: Story = { args: { sequence: undefined } };

export const RecoveredRevenue: Story = { render: () => <RecoveredView r={recovered} days={90} /> };

export const RecoveredWithoutHoldout: Story = {
  render: () => (
    <RecoveredView
      r={{
        ...recovered,
        holdout_leads: 0,
        holdout_converted: 0,
        holdout_conversion_rate: null,
        incremental_revenue_minor: null,
      }}
    />
  ),
};
