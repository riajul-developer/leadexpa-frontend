"use client";

import { AlertTriangle, CheckCircle2, Clock, Copy, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/primitives";

import type { ConnectorCredentials, ConnectorInstall } from "./api";

const TONE = { pending: "neutral", healthy: "success", degraded: "warning", down: "danger" } as const;

export function HealthBadge({ install }: { install: Pick<ConnectorInstall, "health" | "status"> }) {
  const t = useTranslations("connectors");
  if (install.status === "paused") return <Badge tone="warning">{t("paused")}</Badge>;
  const Icon = install.health === "healthy" ? CheckCircle2 : install.health === "pending" ? Clock : AlertTriangle;
  return (
    <Badge tone={TONE[install.health]}>
      <Icon aria-hidden />
      {t(`health.${install.health}`)}
    </Badge>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const t = useTranslations("connectors.credentials");
  return (
    <div className="grid gap-1">
      <span className="text-muted text-xs font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <code className="bg-surface-2 min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs" dir="ltr">
          {value}
        </code>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t("copy", { what: label })}
          onClick={() => void navigator.clipboard.writeText(value).then(() => toast.success(t("copied")))}
        >
          <Copy aria-hidden />
        </Button>
      </span>
    </div>
  );
}

export function CredentialsPanel({ connector, credentials }: { connector: string; credentials: ConnectorCredentials }) {
  const t = useTranslations("connectors.credentials");
  return (
    <div className="grid gap-3">
      <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-lg p-3 text-sm" role="status">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("once")}
      </p>
      <CopyLine label={t(`endpoint.${credentials.key_label}`)} value={credentials.endpoint} />
      {credentials.key && <CopyLine label={t(`key.${credentials.key_label}`)} value={credentials.key} />}
      {credentials.example && (
        <div className="grid gap-1">
          <span className="text-muted text-xs font-medium">{t("example")}</span>
          <pre className="bg-surface-2 overflow-x-auto rounded p-2 text-xs" dir="ltr">
            {credentials.example}
          </pre>
        </div>
      )}
      <ol className="text-muted grid list-decimal gap-1 ps-5 text-sm">
        {(["one", "two", "three"] as const).map((n) => (
          <li key={n}>{t(`steps.${stepsKey(connector)}.${n}`)}</li>
        ))}
      </ol>
    </div>
  );
}

function stepsKey(connector: string) {
  return connector === "google_ads" || connector === "inbound_api" ? connector : "webhook";
}
