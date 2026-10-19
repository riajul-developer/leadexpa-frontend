import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { clients } from "@/mocks/db";

import { AdAccountsCard } from "./ad-accounts";
import { ConversionsTab } from "./conversions-tab";
import { GoogleAdsCard } from "./google";

const meta = {
  title: "Conversions/ConversionsTab",
  component: ConversionsTab,
  args: { clientId: clients[0]!.id },
} satisfies Meta<typeof ConversionsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AcceptedWithDestinations: Story = {};

export const TermsNotAccepted: Story = { args: { clientId: clients[1]?.id ?? clients[0]!.id } };

export const SpendSync: Story = {
  render: () => <AdAccountsCard clientId={clients[0]!.id} currency={clients[0]!.currency} />,
};

export const GoogleConnection: Story = { render: () => <GoogleAdsCard /> };
