import type { Metadata } from "next";

import { AcceptInvite } from "@/features/auth";

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInvite token={token} />;
}
