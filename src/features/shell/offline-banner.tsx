"use client";

import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { inboxKeys, leadKeys } from "@/shared/lib/query-keys";
import { toast } from "@/shared/lib/toast";

/**
 * "You're offline" with the number of outcomes waiting; replays them when the connection returns.
 * The queue module (zustand persist store + replay) loads right after mount instead of in the first-load bundle.
 */
export function OfflineBanner() {
  const t = useTranslations("shell");
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    let sync = async () => {};
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    void import("@/shared/lib/offline-queue").then(({ replayQueue, useOfflineQueue }) => {
      if (cancelled) return;
      setPending(useOfflineQueue.getState().items.length);
      unsubscribe = useOfflineQueue.subscribe((s) => setPending(s.items.length));
      sync = async () => {
        const { sent, rejected } = await replayQueue();
        if (sent.length) toast.success(t("synced", { count: sent.length }));
        if (rejected.length) toast.error(t("syncRejected", { count: rejected.length }));
        if (sent.length || rejected.length) {
          void qc.invalidateQueries({ queryKey: inboxKeys.all });
          for (const i of [...sent, ...rejected]) void qc.invalidateQueries({ queryKey: leadKeys.detail(i.leadId) });
        }
      };
      update(); // replay anything left from a previous session
    });
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [qc, t]);

  if (online && pending === 0) return null;
  return (
    <div role="status" className="bg-warning-soft text-warning flex items-center gap-2 px-4 py-2 text-sm">
      <WifiOff className="size-4" aria-hidden />
      {online ? t("syncing", { count: pending }) : t("offline", { count: pending })}
    </div>
  );
}
