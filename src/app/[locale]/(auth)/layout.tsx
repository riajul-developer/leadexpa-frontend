import { ClientRoot } from "../client-root";

const NAMESPACES = ["auth", "validation", "errors", "errorBoundary", "common", "roles", "units", "billing"];

export default function AuthLayout({
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
