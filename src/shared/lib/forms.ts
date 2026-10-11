"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { isApiError } from "./api/errors";
import { toLatinDigits } from "./format";

/**
 * Maps a 422's field errors onto React Hook Form fields by name; returns a form-level message for anything
 * else (localized by error code). Returns null when every error landed on a field.
 */
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

/** For number/phone inputs: accept Bangla digits as typed and normalize before validation. */
export function normalizeDigits(v: unknown): unknown {
  return typeof v === "string" ? toLatinDigits(v) : v;
}
