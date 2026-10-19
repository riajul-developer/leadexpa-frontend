import { ClientRoot } from "../client-root";

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
