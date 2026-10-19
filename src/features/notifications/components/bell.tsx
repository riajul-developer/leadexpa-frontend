"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, lazy, Suspense } from "react";

import { useDeferredOverlay } from "@/shared/hooks/use-deferred-overlay";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { notificationKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";

export type Page = { data: Schemas["Notification"][]; unread_count: number; next_cursor: string | null };

// SSE prepends new notifications to this cache.
export const notificationsQuery = queryOptions({
  queryKey: notificationKeys.list(false),
  queryFn: () => unwrap(api.GET("/v1/notifications", { params: { query: { limit: 30 } } })),
  staleTime: 60_000,
});

const load = () => import("./bell-popover");
const NotificationPopover = lazy(() => load().then((m) => ({ default: m.NotificationPopover })));

export const BellButton = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button"> & { unread: number }>(
  function BellButton({ unread, ...props }, ref) {
    const t = useTranslations("notifications");
    const f = useFormat();
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={t("bell", { count: unread })}
        {...props}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="bg-danger absolute end-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 99 ? "99+" : f.number(unread)}
          </span>
        )}
      </Button>
    );
  },
);

export function NotificationBell() {
  const list = useQuery(notificationsQuery);
  const { mounted, triggerProps } = useDeferredOverlay(load);
  const placeholder = <BellButton unread={list.data?.unread_count ?? 0} aria-haspopup="dialog" {...triggerProps} />;
  if (!mounted) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <NotificationPopover defaultOpen />
    </Suspense>
  );
}
