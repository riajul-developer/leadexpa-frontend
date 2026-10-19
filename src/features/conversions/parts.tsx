"use client";

import { AlertTriangle, CheckCircle2, Clock, Megaphone, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/shared/ui/primitives";

import type { Health, Platform } from "./api";

const TONE = { pending: "neutral", healthy: "success", degraded: "warning", down: "danger" } as const;

export function HealthBadge({ health, paused }: { health: Health; paused?: boolean }) {
  const t = useTranslations("conversions");
  if (paused) return <Badge tone="warning">{t("paused")}</Badge>;
  const Icon = health === "healthy" ? CheckCircle2 : health === "pending" ? Clock : AlertTriangle;
  return (
    <Badge tone={TONE[health]}>
      <Icon aria-hidden />
      {t(`health.${health}`)}
    </Badge>
  );
}

export function PlatformIcon({ platform }: { platform: Platform }) {
  const Icon = platform === "meta" ? Megaphone : Search;
  return <Icon className="text-primary size-5 shrink-0" aria-hidden />;
}

export const PLATFORM_NAME: Record<Platform, string> = { meta: "Meta", google_ads: "Google Ads" };
