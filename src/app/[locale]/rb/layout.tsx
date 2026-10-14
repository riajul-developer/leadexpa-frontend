import { ClientRoot } from "../client-root";

// A shared custom report (8g): public, only its own strings, no app shell.
const NAMESPACES = ["reportBuilder", "ask", "stage", "errors", "errorBoundary", "common", "units"];

export default function SharedReportLayout({
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
