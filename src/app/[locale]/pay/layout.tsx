import { ClientRoot } from "../client-root";

// The payer's page (17.0.2) is public: only its own strings, no app shell. Opened from WhatsApp on cheap phones.
const NAMESPACES = ["payPage", "errors", "errorBoundary", "common", "units"];

export default function PayLayout({
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
