"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { isApiError } from "./api/errors";
import { toLatinDigits } from "./format";

export function useApplyApiError<T extends FieldValues>(setError: UseFormSetError<T>) {
  const t = useTranslations("errors");
  return useCallback(
    (e: unknown, fields: readonly Path<T>[] = []): string | null => {
      if (!isApiError(e)) return t("network");
      let unplaced = false;
      for (const [field, fe] of Object.entries(e.fieldErrors)) {
        const name = field as Path<T>;
        if (fields.includes(name)) {
          setError(name, { type: fe.code, message: t.has(`field.${fe.code}`) ? t(`field.${fe.code}`) : fe.message });
        } else unplaced = true;
      }
      if (Object.keys(e.fieldErrors).length > 0 && !unplaced) return null;
      if (e.retryAfter) return t("rate_limited_wait", { seconds: e.retryAfter });
      return t.has(e.code) ? t(e.code) : (e.detail ?? t("internal"));
    },
    [setError, t],
  );
}

export function normalizeDigits(v: unknown): unknown {
  return typeof v === "string" ? toLatinDigits(v) : v;
}
