import { ClientRoot } from "../client-root";

// The client portal's branded sign-in (8f): public, in the agency's brand, no app shell.
export default function PortalSignInLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <ClientRoot params={params}>{children}</ClientRoot>;
}
