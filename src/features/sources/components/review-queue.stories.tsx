import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ReviewQueue } from "./review-queue";

const meta = {
  title: "Sources/ReviewQueue",
  component: ReviewQueue,
} satisfies Meta<typeof ReviewQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
