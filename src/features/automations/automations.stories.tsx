import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ruleRuns, rules } from "@/mocks/db";

import { Checks, RuleBuilder } from "./rule-builder";

const meta = {
  title: "Automations/RuleBuilder",
  component: RuleBuilder,
  args: { rule: rules[0] },
} satisfies Meta<typeof RuleBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditRule: Story = {};

export const NewRule: Story = { args: { rule: undefined } };

export const WhyItDidntRun: Story = { render: () => <Checks checks={ruleRuns[1]?.explain ?? []} /> };
