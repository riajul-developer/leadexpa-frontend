import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { clients } from "@/mocks/db";

import { AdoptionCard } from "./adoption-card";

/** Client staff adoption (17.0.3): outcome rate, time to log, active staff, idle list and the SMS nudge. */
const meta = {
  title: "Clients/AdoptionCard",
  component: AdoptionCard,
  args: { clientId: clients[0]!.id },
} satisfies Meta<typeof AdoptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
