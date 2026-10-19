import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { connectorCatalog, connectorCredentials, connectorInstalls } from "@/mocks/db";

import { ConnectorsCard } from "./connectors-card";
import { ConnectorInstallPage } from "./install-page";
import { CredentialsPanel } from "./parts";

const meta = {
  title: "Connectors/InstallPage",
  component: ConnectorInstallPage,
  args: { id: connectorInstalls[0]!.id },
} satisfies Meta<typeof ConnectorInstallPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const FailingWebhook: Story = { args: { id: connectorInstalls[1]?.id ?? connectorInstalls[0]!.id } };

export const List: Story = { render: () => <ConnectorsCard /> };

export const ApiKeyShownOnce: Story = {
  render: () => {
    const api = connectorInstalls[0]!;
    return (
      <CredentialsPanel
        connector={connectorCatalog[2]!.key}
        credentials={connectorCredentials({
          ...api,
          connector: "inbound_api",
          endpoint: "http://localhost:8080/v1/inbound/leads",
        })}
      />
    );
  },
};
