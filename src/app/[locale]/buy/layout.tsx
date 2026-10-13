import { ClientRoot } from "../client-root";

// The reseller's checkout page (6c) is public: the agency's customer has no account. Only its own strings.
const NAMESPACES = ["buyPage", "errors", "errorBoundary", "common", "units"];

export default function BuyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <ClientRoot params={params} namespaces={NAMESPACES}>
      {children}
    </ClientRoot>
  );
}
