import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { calls, clients } from "@/mocks/db";

import { CallDetail } from "./call-detail";
import { Coaching } from "./coaching";
import { VoiceNumbers } from "./voice-numbers";

/** Calls (17.8): a recorded call with its transcript and AI notes, per-agent coaching, and calling numbers. */
const meta = {
  title: "Calls/CallDetail",
  component: CallDetail,
  args: { callId: calls[0]!.id },
} satisfies Meta<typeof CallDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecordedWithNotes: Story = {};

export const MissedInbound: Story = { args: { callId: calls[2]?.id ?? calls[0]!.id } };

export const AgentCoaching: Story = { render: () => <Coaching /> };

export const CallingNumbers: Story = { render: () => <VoiceNumbers clientId={clients[0]!.id} /> };
