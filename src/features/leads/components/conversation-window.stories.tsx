import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { activities, conversations, leads } from "@/mocks/db";

import { ConversationWindow } from "./conversation-window";

const dmLead = leads.find((l) => conversations.has(l.id))!;

const meta = {
  title: "Leads/ConversationWindow",
  component: ConversationWindow,
  args: { lead: dmLead, activities: activities.get(dmLead.id) ?? [] },
} satisfies Meta<typeof ConversationWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
