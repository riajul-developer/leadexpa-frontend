import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { RouteError } from "./route-error";

/** What every route segment shows instead of a white screen. Without a Sentry DSN the reference is the digest. */
const meta = {
  title: "UI/RouteError",
  component: RouteError,
  args: { error: Object.assign(new Error("boom"), { digest: "2481937465" }), reset: fn() },
} satisfies Meta<typeof RouteError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
