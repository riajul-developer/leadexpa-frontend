"use client";

import { useQuery } from "@tanstack/react-query";
import { MailQuestion } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { api, unwrap } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { reviewKeys } from "@/shared/lib/query-keys";

/**
 * Nav entry for forwarded emails waiting for review (17.0.4). Shown only while something waits, so agencies
 * that don't use email-in never see it. Loaded after first paint, like the Junk count.
 */
export function ReviewLink({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: reviewKeys.count,
    queryFn: () => unwrap(api.GET("/v1/ingestion/review/count")),
    staleTime: 60_000,
    meta: { silent: true },
  });
  if (!data?.count && pathname !== "/review") return null;
  const active = pathname === "/review";
  return (
    <Link
      href="/review"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
        active
          ? "text-primary bg-primary-soft before:bg-accent relative font-semibold before:absolute before:inset-y-1.5 before:start-0 before:w-1 before:rounded-full"
          : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <MailQuestion className="size-4" aria-hidden />
      {t("review")}
      {!!data?.count && (
        <span className="bg-warning-soft text-warning ms-auto rounded-full px-1.5 text-xs font-semibold">
          {data.count}
        </span>
      )}
    </Link>
  );
}
