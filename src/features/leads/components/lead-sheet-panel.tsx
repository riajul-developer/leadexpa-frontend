"use client";

import { Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/shared/ui/primitives";
import { SheetModal } from "@/shared/ui/sheet";

import { useLead } from "../api/hooks";

// The timeline, AI panel and sales load with the detail, after the sheet is already on screen.
const LeadDetail = dynamic(() => import("./lead-detail").then((m) => m.LeadDetail), {
  loading: () => (
    <div className="grid gap-3 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  ),
});

/** The lead side sheet; loaded by LeadSheet the first time a lead is opened. */
export function LeadSheetPanel({ leadId, onClose }: { leadId: string | undefined; onClose: () => void }) {
  const t = useTranslations("leadDetail");
  const lead = useLead(leadId);
  return (
    <SheetModal
      open={!!leadId}
      onOpenChange={(o) => !o && onClose()}
      title={lead.data?.full_name || lead.data?.phone?.display || t("title")}
      className="sm:max-w-2xl lg:max-w-3xl"
      actions={
        leadId && (
          <Link
            href={`/leads/${leadId}`}
            className="text-primary hover:bg-surface-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors"
          >
            <Maximize2 className="size-3.5" aria-hidden />
            {t("openFull")}
          </Link>
        )
      }
    >
      {leadId && <LeadDetail leadId={leadId} compact />}
    </SheetModal>
  );
}
