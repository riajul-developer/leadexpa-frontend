"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";

import { captureError } from "../lib/monitoring";

import { Button } from "./button";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function RouteError({ error, reset }: RouteErrorProps) {
  const t = useTranslations("errorBoundary");
  const router = useRouter();
  const [eventId, setEventId] = useState<string>();

  useEffect(() => {
    let live = true;
    void captureError(error, { boundary: "route" }).then((id) => live && setEventId(id));
    return () => {
      live = false;
    };
  }, [error]);

  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  const reference = eventId ?? error.digest;
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <AlertTriangle className="text-warning size-10" aria-hidden />
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-muted max-w-sm text-sm">{t("description")}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={retry}>{t("retry")}</Button>
        <Button variant="secondary" onClick={() => router.push("/inbox")}>
          {t("home")}
        </Button>
      </div>
      {reference && (
        <p className="text-muted mt-2 text-xs">
          {t("reference")} <code className="select-all">{reference}</code>
        </p>
      )}
    </div>
  );
}
