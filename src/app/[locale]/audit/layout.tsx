import { ClientRoot } from "../client-root";

const NAMESPACES = ["revintel", "clients", "errors", "errorBoundary", "common", "units"];

export default function AuditLayout({
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
