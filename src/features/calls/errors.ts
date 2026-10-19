"use client";

import { useTranslations } from "next-intl";

import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";

export function useCallErrorToast() {
  const te = useTranslations("errors");
  return (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
}
