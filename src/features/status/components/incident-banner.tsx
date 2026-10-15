"use client";

import { TriangleAlert, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { localized, useServiceStatus } from "../api";

/** Shown in the app while an incident or maintenance affects this region (G7j). */
export function IncidentBanner() {
  const t = useTranslations("serviceStatus.banner");
  const locale = useLocale();
  const q = useServiceStatus();
  const incident = q.data?.active[0];
  if (!incident) return null;
  const maintenance = incident.kind === "maintenance";
  const latest = incident.updates[0];
  return (
    <div
      role="status"
      data-testid="incident-banner"
      className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm ${maintenance ? "bg-info-soft text-info" : "bg-warning-soft text-warning"}`}
    >
      {maintenance ? (
        <Wrench className="size-4 shrink-0" aria-hidden />
      ) : (
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
      )}
      <span className="font-medium">{localized(incident.title, locale)}</span>
      {latest && <span className="min-w-0 truncate">{localized(latest.body, locale)}</span>}
      <Link href="/status" className="ms-auto underline" target="_blank">
        {t("details")}
      </Link>
    </div>
  );
}
