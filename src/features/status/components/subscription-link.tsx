"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { postSubscription } from "../api";

type State = "working" | "done" | "invalid" | "failed";

/** Confirms or unsubscribes from an emailed link (ADR 0061). */
export function SubscriptionLink({ action }: { action: "confirm" | "unsubscribe" }) {
  const t = useTranslations("serviceStatus.subscribe");
  const locale = useLocale();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<State>(token ? "working" : "invalid");
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    postSubscription(action === "confirm" ? "/confirm" : "/unsubscribe", { token })
      .then((r) => setState(r.status === 200 || r.status === 204 ? "done" : r.status === 404 ? "invalid" : "failed"))
      .catch(() => setState("failed"));
  }, [action, token]);
  const tone =
    state === "done"
      ? "bg-success-soft text-success"
      : state === "working"
        ? "bg-surface-2 text-muted"
        : "bg-danger-soft text-danger";
  return (
    <main className="min-h-dvh">
      <div className="mx-auto grid max-w-xl gap-4 px-4 py-12">
        <h1 className="text-2xl font-semibold">{t(`${action}.title`)}</h1>
        <p role={state === "working" ? "status" : "alert"} className={`rounded-lg px-4 py-3 text-sm ${tone}`}>
          {t(`${action}.${state}`)}
        </p>
        <Link
          href={`/${locale}/status`}
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
