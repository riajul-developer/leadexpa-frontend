import { ClientRoot } from "../client-root";

// The client portal (8f): client viewers see their own business in the agency's brand, without the agency workspace.
export default function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <ClientRoot params={params}>{children}</ClientRoot>;
}
