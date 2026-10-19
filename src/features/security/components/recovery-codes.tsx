"use client";

import { Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/overlays";

export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("security.recovery");
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="grid gap-4">
      <p className="text-sm">{t("explain")}</p>
      <ol className="bg-surface-2 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg p-4 font-mono text-sm" dir="ltr">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success(t("copied")))}
        >
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain" }));
            a.download = "recov-recovery-codes.txt";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download aria-hidden />
          {t("download")}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        {t("saved")}
      </label>
      <Button type="button" onClick={onDone} disabled={!saved}>
        {t("done")}
      </Button>
    </div>
  );
}
