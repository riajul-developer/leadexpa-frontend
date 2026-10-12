"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/shared/ui/primitives";

import type { CallStatus } from "./api";

const TONE: Partial<Record<CallStatus, "success" | "danger" | "warning" | "primary">> = {
  completed: "success",
  missed: "danger",
  failed: "danger",
  no_answer: "warning",
  busy: "warning",
  agent_missed: "warning",
  ringing: "primary",
  in_progress: "primary",
  initiated: "primary",
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const t = useTranslations("calls.status");
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
