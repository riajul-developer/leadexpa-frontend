import { ClientRoot } from "../client-root";

const NAMESPACES = ["bookPage", "appointments", "errors", "errorBoundary", "common", "units"];

export default function BookLayout({
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
