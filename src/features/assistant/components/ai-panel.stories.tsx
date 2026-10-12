import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { leads } from "@/mocks/db";

import { AiPanel } from "./ai-panel";

/** AI draft card: channel/language/tone, draft, and the template fallback when AI is unavailable. */
const meta = {
  title: "Leads/AiDraftCard",
  component: AiPanel,
  args: { lead: leads[0]!, onApplyStage: fn(), onUseAsNote: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AiPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
