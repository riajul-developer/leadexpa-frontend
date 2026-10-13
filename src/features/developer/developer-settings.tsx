"use client";

import { useTranslations } from "next-intl";

import { ApiKeysCard } from "./api-keys-card";
import { WebhooksCard } from "./webhooks-card";

/** Settings › Developer: the public API's agency side (API keys) and outgoing webhooks. */
export function DeveloperSettings() {
  const t = useTranslations("developer");
  return (
    <div className="grid gap-4">
      <div className="rounded-card border-border bg-surface relative overflow-hidden border p-4">
        <div aria-hidden className="absolute inset-y-0 start-0 w-1 [background:var(--brand-rule)]" />
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-muted text-sm">{t("intro")}</p>
      </div>
      <ApiKeysCard />
      <WebhooksCard />
    </div>
  );
}
