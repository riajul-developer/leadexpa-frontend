import { ClientRoot } from "../client-root";

// Sign-in screens only need these strings (smaller first load on 4G).
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
