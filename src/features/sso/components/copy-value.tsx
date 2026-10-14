"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { toast } from "@/shared/lib/toast";

export function useCopy() {
  const t = useTranslations("sso");
  return (v: string) =>
    navigator.clipboard
      .writeText(v)
      .then(() => toast.success(t("copied")))
      .catch(() => toast.success(v));
}

/** A value to paste into the identity provider, DNS or a SIEM, with a copy button. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  const t = useTranslations("sso");
  const copy = useCopy();
  return (
    <div className="grid gap-0.5">
      <span className="text-muted text-xs">{label}</span>
      <button
        type="button"
        onClick={() => copy(value)}
        aria-label={t("copyValue", { name: label })}
        className="inline-flex items-start gap-1 text-start font-mono text-xs break-all hover:underline"
      >
        <span dir="ltr">{value}</span>
        <Copy className="mt-0.5 size-3 shrink-0" aria-hidden />
      </button>
    </div>
  );
}
