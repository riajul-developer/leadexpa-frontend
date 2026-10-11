import { ClientRoot } from "../client-root";

export default function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <ClientRoot params={params}>{children}</ClientRoot>;
}
