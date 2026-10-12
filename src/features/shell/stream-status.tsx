"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/cn";
import type { StreamStatus as Status } from "@/shared/lib/realtime";

const DOT: Record<Status, string> = {
  open: "bg-success",
  connecting: "bg-warning",
  paused: "bg-muted",
  offline: "bg-danger",
};

/** Live-updates indicator: text + dot (never color alone). */
export function StreamStatus() {
  const t = useTranslations("shell.stream");
  const [status, setStatus] = useState<Status>("connecting");
  // The stream client loads with the (lazy) realtime bridge, not in the first-load bundle.
  useEffect(() => {
    let off: (() => void) | undefined;
    let gone = false;
    void import("@/shared/lib/realtime").then(({ realtime }) => {
      if (!gone) off = realtime.onStatus(setStatus);
    });
    return () => {
      gone = true;
      off?.();
    };
  }, []);
  return (
    <p className="text-muted flex items-center gap-2 px-2 py-1 text-xs" role="status">
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
      {t(status)}
    </p>
  );
}
