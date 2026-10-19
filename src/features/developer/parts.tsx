"use client";

import { Copy, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/primitives";

import type { ApiKey, DeliveryStatus, WebhookEndpoint } from "./api";

export function SecretOnce({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  const t = useTranslations("developer");
  return (
    <div className="grid gap-3">
      <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-lg p-3 text-sm" role="status">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("secretOnce")}
      </p>
      <div className="grid gap-1">
        <span className="text-muted text-xs font-medium">{label}</span>
        <span className="flex items-center gap-2">
          <code
            className="bg-surface-2 border-border min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs break-all"
            dir="ltr"
          >
            {value}
          </code>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            aria-label={t("copy", { what: label })}
            onClick={() => void navigator.clipboard.writeText(value).then(() => toast.success(t("copied")))}
          >
            <Copy aria-hidden />
          </Button>
        </span>
      </div>
      {children}
    </div>
  );
}

export function KeyStatusBadge({ status }: { status: ApiKey["status"] }) {
  const t = useTranslations("developer.keys.status");
  const variant = status === "active" ? "success" : status === "expired" ? "warning" : "neutral";
  return <Badge tone={variant}>{t(status)}</Badge>;
}

export function EndpointStatusBadge({ endpoint }: { endpoint: WebhookEndpoint }) {
  const t = useTranslations("developer.webhooks.status");
  if (endpoint.status === "active") return <Badge tone="success">{t("active")}</Badge>;
  return (
    <Badge tone={endpoint.disabled_reason === "failing" ? "danger" : "neutral"}>
      {t(endpoint.disabled_reason ?? "manual")}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status, code }: { status: DeliveryStatus; code: number | null }) {
  const t = useTranslations("developer.deliveries.status");
  const variant = status === "succeeded" ? "success" : status === "failed" ? "danger" : "warning";
  return (
    <Badge tone={variant}>
      {t(status)}
      {code != null && (
        <span className="tabular-nums" dir="ltr">
          · {code}
        </span>
      )}
    </Badge>
  );
}

export function useEventLabel() {
  const t = useTranslations("developer.events");
  return (e: string) => (t.has(e.replace(".", "_")) ? t(e.replace(".", "_")) : e);
}
