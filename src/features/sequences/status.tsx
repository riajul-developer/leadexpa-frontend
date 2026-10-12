"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/shared/ui/primitives";

import type { Sequence } from "./api";

const TONE = { draft: "neutral", active: "success", paused: "warning", archived: "neutral" } as const;

export function SequenceStatusBadge({ status }: { status: Sequence["status"] }) {
  const t = useTranslations("sequences.status");
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
