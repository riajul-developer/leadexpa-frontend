"use client";

import { ContactFlowHost, LeadDetail } from "@/features/leads";

export function LeadPage({ leadId }: { leadId: string }) {
  return (
    <>
      <LeadDetail leadId={leadId} />
      <ContactFlowHost />
    </>
  );
}
