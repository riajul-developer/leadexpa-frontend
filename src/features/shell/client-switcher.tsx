"use client";

import { Building2, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, lazy, Suspense } from "react";

import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useDeferredOverlay } from "@/shared/hooks/use-deferred-overlay";
import { useClients } from "@/shared/lib/lookups";
import { Button } from "@/shared/ui/button";

const load = () => import("./client-switcher-menu");
const ClientSwitcherMenu = lazy(() => load().then((m) => ({ default: m.ClientSwitcherMenu })));

/** The trigger, shared by the placeholder and the real menu (Radix passes its props and ref through). */
export const ClientSwitcherButton = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button">>(
  function ClientSwitcherButton(props, ref) {
    const t = useTranslations("shell");
    const active = useActiveClient();
    const { clients } = useClients();
    const current = clients.find((c) => c.id === active);
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        className="max-w-56 justify-start"
        aria-label={t("clientFilter")}
        {...props}
      >
        <Building2 aria-hidden />
        <span className="truncate">{current?.name ?? t("allClients")}</span>
        <ChevronDown className="text-muted" aria-hidden />
      </Button>
    );
  },
);

/** Global client filter in the top bar, persisted as ?client= so links stay shareable. Menu loads on first open. */
export function ClientSwitcher() {
  const { clients } = useClients();
  const { mounted, triggerProps } = useDeferredOverlay(load);
  if (!clients.some((c) => c.status === "active")) return null;
  const placeholder = <ClientSwitcherButton aria-haspopup="menu" {...triggerProps} />;
  if (!mounted) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <ClientSwitcherMenu defaultOpen />
    </Suspense>
  );
}
