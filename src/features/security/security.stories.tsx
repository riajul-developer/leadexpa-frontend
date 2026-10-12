import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MFAStep } from "@/features/auth";
import { me, recoveryCodes } from "@/mocks/db";

import { MFAGate } from "./components/mfa-gate";
import { RecoveryCodes } from "./components/recovery-codes";
import { SecuritySettings } from "./components/security-settings";
import { TOTPSetup } from "./components/totp-setup";

/** Security (17.6): two-step sign-in, passkeys, recovery codes, signed-in devices and the agency gate. */
const meta = {
  title: "Security/Settings",
  component: SecuritySettings,
} satisfies Meta<typeof SecuritySettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const AuthenticatorAppSetup: Story = { render: () => <TOTPSetup onDone={() => undefined} /> };

export const NewRecoveryCodes: Story = {
  render: () => <RecoveryCodes codes={recoveryCodes} onDone={() => undefined} />,
};

export const SignInSecondStep: Story = {
  render: () => (
    <div className="max-w-sm">
      <MFAStep
        challenge={{
          mfa_required: true,
          mfa_token: "mock-mfa-token",
          methods: ["passkey", "totp", "recovery_code"],
          expires_at: new Date(Date.now() + 300_000).toISOString(),
        }}
        onDone={() => undefined}
        onRestart={() => undefined}
      />
    </div>
  ),
};

const gated = (enrolled: boolean) => ({
  ...me,
  agency: null,
  mfa_required: { agency_id: me.agency!.id, agency_name: me.agency!.name, enrolled },
});

export const AgencyGateSetUp: Story = { render: () => <MFAGate me={gated(false)} /> };

export const AgencyGateVerify: Story = { render: () => <MFAGate me={gated(true)} /> };
