"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/shared/ui/primitives";

import type { PaymentStatus } from "./api";

const TONES: Record<PaymentStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  created: "info",
  opened: "info",
  paid: "success",
  failed: "warning",
  expired: "neutral",
  cancelled: "neutral",
  refunded: "danger",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("payments.status");
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}

export function providerName(p: string) {
  return p === "bkash" ? "bKash" : p === "sslcommerz" ? "SSLCommerz" : p;
}
