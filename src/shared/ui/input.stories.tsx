import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Field } from "./field";
import { Input, NativeSelect, Textarea } from "./input";
import { MoneyInput } from "./money-input";

const meta = { title: "UI/Inputs", component: Input } satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {
  render: () => (
    <Field label="পুরো নাম" hint="লিডের নাম যেভাবে ফর্মে এসেছে">
      <Input placeholder="রহিমা খাতুন" />
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field label="Email" error="Enter a valid email address">
      <Input defaultValue="rahima@" />
    </Field>
  ),
};

export const PhoneInput: Story = {
  render: () => (
    <Field label="ফোন" hint="01712-345678 অথবা ০১৭১২৩৪৫৬৭৮">
      <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="01712-345678" />
    </Field>
  ),
};

function MoneyDemo() {
  const [text, setText] = useState("১,৪৯,০০০");
  const [minor, setMinor] = useState<number | null>(14_900_000);
  return (
    <div className="grid max-w-xs gap-2">
      <Field label="Deal value">
        <MoneyInput
          currency="BDT"
          value={text}
          onValueChange={(t, m) => {
            setText(t);
            setMinor(m);
          }}
        />
      </Field>
      <output className="text-muted text-sm">amount_minor: {minor ?? "invalid"}</output>
    </div>
  );
}

export const Money: Story = { render: () => <MoneyDemo /> };

export const Select: Story = {
  render: () => (
    <Field label="Stage">
      <NativeSelect defaultValue="contacted">
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="qualified">Qualified</option>
      </NativeSelect>
    </Field>
  ),
};

export const Note: Story = {
  render: () => (
    <Field label="নোট">
      <Textarea rows={3} defaultValue="বিকেল ৪টার পর কল করতে বলেছেন।" />
    </Field>
  ),
};
