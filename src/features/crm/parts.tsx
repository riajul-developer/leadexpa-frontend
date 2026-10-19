"use client";

import { useMutation } from "@tanstack/react-query";
import { Link2Off } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Badge, Spinner } from "@/shared/ui/primitives";

import type { CrmConnection, CrmProviderKey } from "./api";

export const CRM_CALLBACK_MESSAGE = "leadexpa-crm-callback";

// Monogram tiles, not the vendors' logos (their marks are trademarks).
const MARKS: Record<CrmProviderKey, { letters: string; className: string }> = {
  hubspot: { letters: "Hs", className: "bg-[#fdebe4] text-[#a8431c]" },
  salesforce: { letters: "Sf", className: "bg-[#e3f0fb] text-[#0b5cab]" },
  pipedrive: { letters: "Pd", className: "bg-[#e6f4ea] text-[#1d6b3a]" },
  zoho: { letters: "Zo", className: "bg-[#fdf3d8] text-[#8a5a00]" },
};

export function ProviderMark({ provider, className }: { provider: CrmProviderKey; className?: string }) {
  const m = MARKS[provider];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
        m.className,
        className,
      )}
    >
      {m.letters}
    </span>
  );
}

export function HealthBadge({ connection: c }: { connection: Pick<CrmConnection, "status" | "health"> }) {
  const t = useTranslations("crm.health");
  if (c.status === "expired") return <Badge tone="danger">{t("expired")}</Badge>;
  if (c.status === "paused") return <Badge tone="neutral">{t("paused")}</Badge>;
  const tone =
    c.health === "healthy" ? "success" : c.health === "degraded" ? "warning" : c.health === "down" ? "danger" : "info";
  return <Badge tone={tone}>{t(c.health)}</Badge>;
}

export function CrmCallback() {
  const t = useTranslations("crm.callback");
  const te = useTranslations("errors");
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const accountsServer = params.get("accounts-server") ?? undefined; // Zoho names the user's data center
  const [error, setError] = useState<string | null>(params.get("error") ? t("denied") : null);
  const complete = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/v1/crm/callback", { body: { code: code!, state: state!, accounts_server: accountsServer } })),
    meta: { silent: true },
    onSuccess: (c) => {
      track("crm.connected", { provider: c.provider });
      if (window.opener) {
        (window.opener as Window).postMessage({ type: CRM_CALLBACK_MESSAGE }, window.location.origin);
        window.close();
      } else {
        window.location.replace(window.location.pathname.replace(/\/callback$/, "/" + c.id));
      }
    },
    onError: (e) => setError(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed")),
  });
  const { mutate, isIdle } = complete;
  useEffect(() => {
    if (code && state && isIdle) mutate();
  }, [code, state, isIdle, mutate]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="sr-only">{t("title")}</h1>
      {error ? (
        <>
          <Link2Off className="text-danger size-10" aria-hidden />
          <p className="font-medium">{error}</p>
          <Button variant="secondary" onClick={() => (window.opener ? window.close() : history.back())}>
            {t("close")}
          </Button>
        </>
      ) : (
        <Spinner label={t("connecting")} />
      )}
    </main>
  );
}
