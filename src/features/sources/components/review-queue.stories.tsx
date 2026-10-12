import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ReviewQueue } from "./review-queue";

/** Email-in "Needs review" (17.0.4): the original email beside the extracted fields, accept or reject. */
const meta = {
  title: "Sources/ReviewQueue",
  component: ReviewQueue,
} satisfies Meta<typeof ReviewQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
