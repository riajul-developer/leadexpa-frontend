"use client";

import { ContactFlowHost, LeadSheet, LeadsTable } from "@/features/leads";

export function LeadsTableWithSheet() {
  return (
    <>
      <LeadsTable />
      <LeadSheet />
      <ContactFlowHost />
    </>
  );
}
