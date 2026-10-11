"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const LeadSheetPanel = dynamic(() => import("./lead-sheet-panel").then((m) => m.LeadSheetPanel));

/** Lead side sheet state lives in the URL (?lead=…): Back closes it and the link can be shared. */
export function useLeadSheet() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const leadId = params.get("lead") ?? undefined;
  const set = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set("lead", id);
      else next.delete("lead");
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (id && !leadId) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router, leadId],
  );
  return { leadId, open: (id: string) => set(id), close: () => set(null) };
}

/** Mounts the sheet (and fetches its code) the first time a lead is opened; list pages don't ship it. */
export function LeadSheet() {
  const { leadId, close } = useLeadSheet();
  const [opened, setOpened] = useState(!!leadId);
  if (leadId && !opened) setOpened(true);
  return opened ? <LeadSheetPanel leadId={leadId} onClose={close} /> : null;
}
