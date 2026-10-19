"use client";

import {
  Camera,
  FileSpreadsheet,
  Globe,
  Hand,
  Mail,
  Megaphone,
  MessageCircle,
  PhoneCall,
  Plug,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";

import { cn } from "../lib/cn";

import { Badge } from "./primitives";

export type Stage = "new" | "contacted" | "qualified" | "won" | "lost";
export const STAGES: Stage[] = ["new", "contacted", "qualified", "won", "lost"];

const STAGE_TONE = {
  new: "info",
  contacted: "primary",
  qualified: "warning",
  won: "success",
  lost: "neutral",
} as const;

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const t = useTranslations("stage");
  return (
    <Badge tone={STAGE_TONE[stage]} className={className}>
      {t(stage)}
    </Badge>
  );
}

export type SourceKind =
  | "web_form"
  | "csv"
  | "manual"
  | "meta_lead_ads"
  | "api"
  | "email_in"
  | "messenger"
  | "instagram"
  | "whatsapp"
  | "phone"
  | "google_ads"
  | "webhook";

const SOURCE_ICON: Record<SourceKind, LucideIcon> = {
  web_form: Globe,
  csv: FileSpreadsheet,
  manual: Hand,
  meta_lead_ads: Megaphone,
  api: Plug,
  email_in: Mail,
  messenger: MessageCircle,
  instagram: Camera,
  whatsapp: MessageCircle,
  phone: PhoneCall,
  google_ads: Megaphone,
  webhook: Webhook,
};

export function SourceBadge({
  kind,
  label,
  className,
}: {
  kind: SourceKind;
  label?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("source");
  const Icon = SOURCE_ICON[kind] ?? Plug;
  return (
    <Badge
      tone={
        kind === "meta_lead_ads" ||
        kind === "google_ads" ||
        kind === "messenger" ||
        kind === "instagram" ||
        kind === "whatsapp"
          ? "primary"
          : "neutral"
      }
      className={cn("max-w-48", className)}
    >
      <Icon aria-hidden />
      <span className="truncate">{label ?? t(kind)}</span>
    </Badge>
  );
}

export interface LeadQuality {
  status: "valid" | "suspect" | "junk";
  reasons: string[];
  verified_at: string | null;
}

/** Reasons in a native title + sr-only text, not a tooltip: keeps the inbox bundle small. */
export function QualityBadge({ quality, className }: { quality: LeadQuality; className?: string }) {
  const t = useTranslations("quality");
  if (quality.status === "valid") {
    if (!quality.verified_at) return null;
    return (
      <Badge tone="success" className={className} title={t("verifiedHint")}>
        {t("verified")}
      </Badge>
    );
  }
  const reasons = quality.reasons.map((r) => (t.has(`reason.${r}`) ? t(`reason.${r}`) : r)).join(" · ");
  return (
    <Badge tone={quality.status === "junk" ? "danger" : "warning"} className={className} title={reasons}>
      {t(quality.status)}
      {reasons && <span className="sr-only">: {reasons}</span>}
    </Badge>
  );
}

export type LeadScore = {
  value: number;
  band: "hot" | "warm" | "cold";
  version: string;
  factors: { feature: string; effect: number; value: number }[];
};

const SCORE_TONE = { hot: "danger", warm: "warning", cold: "neutral" } as const;

export function useScoreFactor() {
  const t = useTranslations("score.factor");
  return (f: LeadScore["factors"][number]) => {
    const key = `${f.feature}.${f.effect >= 0 ? "up" : "down"}`;
    return t.has(key) ? t(key) : f.feature;
  };
}

export function ScoreBadge({ score, className }: { score: LeadScore | null | undefined; className?: string }) {
  const t = useTranslations("score");
  const factor = useScoreFactor();
  if (!score) return null;
  const why = score.factors.map(factor).join(" · ");
  return (
    <Badge tone={SCORE_TONE[score.band]} className={className} title={why} data-score={score.band}>
      {t(`band.${score.band}`)} {score.value}
      {why && <span className="sr-only">: {why}</span>}
    </Badge>
  );
}
