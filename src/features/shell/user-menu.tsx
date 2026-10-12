"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";

import { useDeferredOverlay } from "@/shared/hooks/use-deferred-overlay";
import { useMe } from "@/shared/lib/session";
import { Avatar } from "@/shared/ui/primitives";

const load = () => import("./user-menu-dropdown");
const UserMenuDropdown = lazy(() => load().then((m) => ({ default: m.UserMenuDropdown })));

export const TRIGGER_CLASS = "hover:bg-surface-2 relative rounded-full p-1";

export function UserAvatar({ name, away }: { name: string; away: boolean }) {
  return (
    <>
      <Avatar name={name} />
      {away && (
        <span
          className="border-surface bg-warning absolute end-0 bottom-0 size-2.5 rounded-full border-2"
          aria-hidden
        />
      )}
    </>
  );
}

/** Account menu. The dropdown (Radix, mutations) loads on first open; until then this is a plain button. */
export function UserMenu() {
  const t = useTranslations("shell");
  const { data: me } = useMe();
  const { mounted, triggerProps } = useDeferredOverlay(load);
  if (!me) return null;
  const placeholder = (
    <button type="button" className={TRIGGER_CLASS} aria-label={t("account")} aria-haspopup="menu" {...triggerProps}>
      <UserAvatar name={me.user.name} away={me.availability === "away"} />
    </button>
  );
  if (!mounted) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <UserMenuDropdown defaultOpen />
    </Suspense>
  );
}
