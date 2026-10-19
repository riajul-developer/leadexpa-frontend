import { ClientRoot } from "../client-root";

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
