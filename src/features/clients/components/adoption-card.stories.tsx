import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { clients } from "@/mocks/db";

import { AdoptionCard } from "./adoption-card";

const meta = {
  title: "Clients/AdoptionCard",
  component: AdoptionCard,
  args: { clientId: clients[0]!.id },
} satisfies Meta<typeof AdoptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
