"use client";

import { useTranslations } from "next-intl";

import { NEXT_STAGES, type Lead, type Stage } from "@/features/leads";
import { Button } from "@/shared/ui/button";
import { DialogModal } from "@/shared/ui/dialog";

/** Next-stage choices for a lead (inbox `s`). Loaded on first use, like the rest of the inbox's dialogs. */
export function StagePicker({
  lead,
  onPick,
  onClose,
}: {
  lead: Lead;
  onPick: (to: Stage) => void;
  onClose: () => void;
}) {
  const t = useTranslations("inbox");
  const ts = useTranslations("stage");
  return (
    <DialogModal open onOpenChange={(o) => !o && onClose()} title={t("changeStage")}>
      <div className="grid gap-2">
        {NEXT_STAGES[lead.stage].map((s) => (
          <Button key={s} variant="secondary" onClick={() => onPick(s)}>
            {ts(s)}
          </Button>
        ))}
      </div>
    </DialogModal>
  );
}

const KEYS = [
  ["j / k", "move"],
  ["Enter", "open"],
  ["c", "call"],
  ["w", "whatsapp"],
  ["o", "outcome"],
  ["s", "stage"],
  ["a", "ai"],
  ["n", "newLead"],
  ["⌘K", "search"],
] as const;

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("inbox.keys");
  return (
    <DialogModal open={open} onOpenChange={onOpenChange} title={t("title")}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {KEYS.map(([k, label]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className="border-border bg-surface-2 rounded border px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
            </dt>
            <dd>{t(label)}</dd>
          </div>
        ))}
      </dl>
    </DialogModal>
  );
}
