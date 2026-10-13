import { ClientRoot } from "../client-root";

// A shared report link: public, only its own strings, no app shell.
const NAMESPACES = ["revintel", "clients", "errors", "errorBoundary", "common", "units"];

export default function ReviewLayout({
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
