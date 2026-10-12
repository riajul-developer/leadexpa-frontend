import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Phone } from "lucide-react";

import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "লিড যোগ করুন" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger", "success", "link"] },
    size: { control: "select", options: ["sm", "md", "lg", "icon", "icon-sm"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {(["primary", "secondary", "ghost", "danger", "success", "link"] as const).map((v) => (
        <Button key={v} {...args} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
};

/** lg is the ≥ 48 px tap target used in agent flows on phones. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} size="sm" />
      <Button {...args} size="md" />
      <Button {...args} size="lg" />
      <Button size="icon" aria-label="Call">
        <Phone />
      </Button>
    </div>
  ),
};
