"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building, Check, FlaskConical, Languages, LogOut, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, LOCALES, NATIVE_DIGITS, toApiLocale, type AppLocale } from "@/shared/config/locales";
import { resetAnalytics, track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty } from "@/shared/lib/api/client";
import { setMonitoringUser } from "@/shared/lib/monitoring";
import { usePreferences } from "@/shared/lib/preferences";
import { realtime } from "@/shared/lib/realtime";
import { meKey, useMe } from "@/shared/lib/session";
import { useUpdateMe } from "@/shared/lib/update-me";
import { Switch } from "@/shared/ui/controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown";

import { TRIGGER_CLASS, UserAvatar } from "./user-menu";

/** The account menu itself; loaded on first open by UserMenu. */
export function UserMenuDropdown({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useTranslations("shell");
  const tr = useTranslations("roles");
  const { data: me } = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { digits } = usePreferences();
  const updateMe = useUpdateMe();
  const nativeDigits = NATIVE_DIGITS[locale as AppLocale];

  const availability = useMutation({
    mutationFn: (available: boolean) =>
      unwrapEmpty(api.POST("/v1/me/availability", { body: { availability: available ? "available" : "away" } })),
    onMutate: (available) => {
      qc.setQueryData(meKey, (old: typeof me) =>
        old ? { ...old, availability: available ? "available" : "away" } : old,
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: meKey }),
  });
  const switchAgency = useMutation({
    mutationFn: (agency_id: string) => unwrap(api.POST("/v1/session/agency", { body: { agency_id } })),
    onSuccess: () => {
      // Everything cached belongs to the previous agency.
      realtime.stop();
      qc.clear();
      window.location.assign(`/${locale}/inbox`);
    },
  });
  const logout = useMutation({
    mutationFn: () => unwrapEmpty(api.POST("/v1/auth/logout")),
    onSettled: () => {
      track("auth.logout");
      realtime.stop();
      resetAnalytics();
      setMonitoringUser(null, null);
      qc.clear();
      router.replace("/login");
    },
  });

  if (!me) return null;
  const away = me.availability === "away";
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger className={TRIGGER_CLASS} aria-label={t("account")}>
        <UserAvatar name={me.user.name} away={away} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-text flex items-center gap-3 text-sm">
          <span className="relative shrink-0 [&>span:first-child]:size-10 [&>span:first-child]:text-sm">
            <UserAvatar name={me.user.name} away={away} />
          </span>
          <span className="grid min-w-0">
            <span className="truncate font-semibold">{me.user.name}</span>
            {me.membership && <span className="text-muted truncate font-normal">{tr(me.membership.role)}</span>}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
          <label htmlFor="availability">{away ? t("away") : t("available")}</label>
          <Switch id="availability" checked={!away} onCheckedChange={(v) => availability.mutate(v)} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <User aria-hidden />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuLabel>
          <Languages className="me-1 inline size-3.5" aria-hidden />
          {t("language")}
        </DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            lang={l}
            onSelect={() => {
              if (l === locale) return;
              updateMe.mutate({ locale: toApiLocale(l) });
              router.replace(pathname, { locale: l });
            }}
          >
            <Check className={l === locale ? "" : "invisible"} aria-hidden />
            {LOCALE_NAMES[l]}
          </DropdownMenuItem>
        ))}
        {nativeDigits && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              updateMe.mutate({ number_system: digits === "latn" ? "native" : "latn" });
            }}
          >
            <span className="text-muted w-4 text-center text-xs font-semibold">
              {digits === "latn" ? nativeDigits[1] : "1"}
            </span>
            {digits === "latn" ? t("useNativeDigits") : t("useLatinDigits")}
          </DropdownMenuItem>
        )}
        {me.agencies.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("switchAgency")}</DropdownMenuLabel>
            {me.agencies.map((a) => (
              <DropdownMenuItem key={a.id} disabled={a.id === me.agency?.id} onSelect={() => switchAgency.mutate(a.id)}>
                {a.id === me.agency?.id ? (
                  <Check aria-hidden />
                ) : a.sandbox ? (
                  <FlaskConical aria-hidden />
                ) : (
                  <Building aria-hidden />
                )}
                <span className="truncate">{a.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut className="rtl:-scale-x-100" aria-hidden />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
