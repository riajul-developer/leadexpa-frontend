import { AppShell } from "@/features/shell";

import { ClientRoot } from "../client-root";

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <ClientRoot params={params}>
      <AppShell>{children}</AppShell>
    </ClientRoot>
  );
}
