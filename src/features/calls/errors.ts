"use client";

import { useTranslations } from "next-intl";

import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";

/** Click-to-call errors say what to fix: add your phone, connect a number, or the lead can't be called. */
export function useCallErrorToast() {
  const te = useTranslations("errors");
  return (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
}
