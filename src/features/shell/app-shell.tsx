"use client";

import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  FileSearch,
  FileText,
  Handshake,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  MonitorPlay,
  Network,
  Menu,
  MessagesSquare,
  PhoneCall,
  Repeat,
  Plug,
  Settings,
  Sparkles,
  Sprout,
  Store,
  ShieldAlert,
  ShoppingBag,
  Table2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useState } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useActiveClient, withClient } from "@/shared/hooks/use-active-client";
import { identify } from "@/shared/lib/analytics";
import { onSessionLost } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { setMonitoringUser } from "@/shared/lib/monitoring";
import { usePreferences } from "@/shared/lib/preferences";
import { useMe } from "@/shared/lib/session";
import { BrandLogo } from "@/shared/ui/brand";
import { LazySheet } from "@/shared/ui/lazy-overlays";
import { Skeleton } from "@/shared/ui/primitives";

import { ClientSwitcher } from "./client-switcher";
import { CommandPalette } from "./command-palette";
import { QuickAddLead } from "./quick-add-lead";
import { UserMenu } from "./user-menu";

interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
  anyOf: string[];
  scoped?: boolean;
  junkCount?: boolean;
  group: NavGroup;
}

const GROUPS = ["work", "automation", "insights", "manage"] as const;
type NavGroup = (typeof GROUPS)[number];

const JunkCount = dynamic(() => import("./junk-count").then((m) => m.JunkCount), { ssr: false });
const MFAGate = dynamic(() => import("@/features/security").then((m) => m.MFAGate), { ssr: false });
const AccessBlockedGate = dynamic(() => import("@/features/security").then((m) => m.AccessBlockedGate), { ssr: false });
const ReviewLink = dynamic(() => import("./review-link").then((m) => m.ReviewLink), { ssr: false });
const RealtimeBridge = dynamic(() => import("./realtime-bridge").then((m) => m.RealtimeBridge), { ssr: false });
const OfflineBanner = dynamic(() => import("./offline-banner").then((m) => m.OfflineBanner), { ssr: false });
const IncidentBanner = dynamic(() => import("@/features/status").then((m) => m.IncidentBanner), { ssr: false });
const SandboxBanner = dynamic(() => import("@/features/sandbox").then((m) => m.SandboxBanner), { ssr: false });
const StreamStatus = dynamic(() => import("./stream-status").then((m) => m.StreamStatus), { ssr: false });
// A same-size placeholder keeps the header still.
const NotificationBell = dynamic(() => import("@/features/notifications").then((m) => m.NotificationBell), {
  ssr: false,
  loading: () => <span className="inline-block size-10" aria-hidden />,
});

const NAV: NavItem[] = [
  { href: "/inbox", key: "inbox", icon: Inbox, anyOf: ["activity.create"], scoped: true, group: "work" },
  {
    href: "/conversations",
    key: "conversations",
    icon: MessagesSquare,
    anyOf: ["activity.create"],
    scoped: true,
    group: "work",
  },
  { href: "/calls", key: "calls", icon: PhoneCall, anyOf: ["activity.create"], scoped: true, group: "work" },
  { href: "/leads", key: "leads", icon: Table2, anyOf: ["lead.read", "lead.read.own"], scoped: true, group: "work" },
  {
    href: "/leads?quality=junk",
    key: "junk",
    icon: ShieldAlert,
    anyOf: ["lead.update"],
    scoped: true,
    junkCount: true,
    group: "work",
  },
  {
    href: "/pipeline",
    key: "pipeline",
    icon: KanbanSquare,
    anyOf: ["lead.read", "lead.read.own"],
    scoped: true,
    group: "work",
  },
  {
    href: "/sequences",
    key: "sequences",
    icon: Repeat,
    anyOf: ["automation.manage"],
    scoped: true,
    group: "automation",
  },
  {
    href: "/automations",
    key: "automations",
    icon: Zap,
    anyOf: ["automation.manage"],
    scoped: true,
    group: "automation",
  },
  {
    href: "/appointments",
    key: "appointments",
    icon: CalendarCheck,
    anyOf: ["activity.create"],
    scoped: true,
    group: "work",
  },
  { href: "/progress", key: "progress", icon: Sprout, anyOf: ["activity.create"], group: "work" },
  { href: "/agent", key: "agent", icon: Bot, anyOf: ["activity.create"], group: "automation" },
  { href: "/dashboard", key: "dashboard", icon: BarChart3, anyOf: ["report.read"], scoped: true, group: "insights" },
  { href: "/reports", key: "reports", icon: FileText, anyOf: ["report.share"], scoped: true, group: "insights" },
  { href: "/insights", key: "insights", icon: Activity, anyOf: ["report.read"], scoped: true, group: "insights" },
  { href: "/ask", key: "ask", icon: Sparkles, anyOf: ["lead.read", "lead.read.own", "report.read"], group: "insights" },
  { href: "/report-builder", key: "reportBuilder", icon: LayoutDashboard, anyOf: ["report.read"], group: "insights" },
  { href: "/wallboards", key: "wallboards", icon: MonitorPlay, anyOf: ["report.share"], group: "insights" },
  { href: "/groups", key: "holdingGroups", icon: Network, anyOf: ["agency.update"], group: "insights" },
  { href: "/clients", key: "clients", icon: Building2, anyOf: ["client.manage", "report.share"], group: "manage" },
  {
    href: "/integrations",
    key: "integrations",
    icon: Plug,
    anyOf: ["integration.manage", "client.manage", "lead.import"],
    group: "manage",
  },
  { href: "/audits", key: "audits", icon: FileSearch, anyOf: ["client.manage"], group: "manage" },
  { href: "/marketplace", key: "marketplace", icon: Store, anyOf: ["integration.manage"], group: "manage" },
  { href: "/reseller", key: "reseller", icon: ShoppingBag, anyOf: ["billing.manage"], group: "manage" },
  { href: "/partners", key: "partners", icon: Handshake, anyOf: ["billing.manage"], group: "manage" },
  { href: "/settings/profile", key: "settings", icon: Settings, anyOf: [], group: "manage" },
];

const MOBILE_PRIMARY = ["inbox", "leads", "pipeline", "dashboard"];

function useNav() {
  const { data: me } = useMe();
  const perms = new Set(me?.permissions ?? []);
  return NAV.filter((n) => n.anyOf.length === 0 || n.anyOf.some((p) => perms.has(p)));
}

function NavLink({ item, onNavigate, compact }: { item: NavItem; onNavigate?: () => void; compact?: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const client = useActiveClient();
  const active =
    pathname === item.href ||
    pathname.startsWith(item.href.replace(/\/profile$/, "") + "/") ||
    pathname === item.href.replace(/\/profile$/, "");
  const Icon = item.icon;
  return (
    <Link
      href={item.scoped ? withClient(item.href, client) : item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        compact
          ? "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
          : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
        active
          ? "text-primary font-semibold" +
              (compact
                ? ""
                : " bg-primary-soft before:bg-accent relative before:absolute before:inset-y-1.5 before:start-0 before:w-1 before:rounded-full")
          : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon className={compact ? "size-5" : "size-4"} aria-hidden />
      {t(item.key)}
      {item.junkCount && !compact && <JunkCount />}
    </Link>
  );
}

function GroupedNav({
  nav,
  reviewAfter,
  canReview,
  onNavigate,
}: {
  nav: NavItem[];
  reviewAfter: string;
  canReview: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  return (
    <>
      {GROUPS.map((g) => {
        const items = nav.filter((n) => n.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} role="group" aria-labelledby={`nav-${g}`} className="flex flex-col gap-1">
            <p id={`nav-${g}`} className="text-muted px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
              {t(`groups.${g}`)}
            </p>
            {items.map((n) => (
              <Fragment key={n.key}>
                <NavLink item={n} onNavigate={onNavigate} />
                {canReview && n.key === reviewAfter && <ReviewLink onNavigate={onNavigate} />}
              </Fragment>
            ))}
          </div>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const { data: me, isPending, isError } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const nav = useNav();
  const canReview = !!me?.permissions.includes("lead.assign");
  const reviewAfter = nav.some((n) => n.key === "junk") ? "junk" : "leads";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(
    () =>
      onSessionLost((reason) => {
        const back = encodeURIComponent(window.location.pathname + window.location.search);
        router.replace(`/login?returnTo=${back}${reason === "session_policy" ? "&reason=session_policy" : ""}`);
      }),
    [router],
  );
  useEffect(() => {
    if (isError) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [isError, pathname, router]);
  useEffect(() => {
    if (me?.membership?.role === "client_viewer") router.replace("/portal");
  }, [me, router]);
  useEffect(() => {
    if (me && !me.agency && !me.mfa_required && !me.access_blocked && !pathname.startsWith("/onboarding"))
      router.replace("/onboarding/agency");
  }, [me, pathname, router]);
  useEffect(() => {
    if (!me) return;
    usePreferences.getState().syncFromMe(me);
    identify(me.user.id, me.agency?.id ?? null, me.membership?.role ?? null);
    setMonitoringUser(me.user.id, me.agency?.id ?? null);
  }, [me]);

  if (isPending || !me) {
    return (
      // Same frame as the loaded shell, so nothing jumps when it arrives.
      <div className="flex min-h-dvh" aria-busy>
        <div className="border-border bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-3 border-e p-4 md:flex">
          <Skeleton className="h-8 w-32" />
          <div className="mt-4 grid gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-border bg-surface/95 h-14 border-b">
            <div className="max-w-app mx-auto flex h-full w-full items-center gap-2 px-3 md:px-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="ms-auto h-8 w-20" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
          <div className="max-w-app mx-auto w-full flex-1 p-3 md:p-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (me.access_blocked) return <AccessBlockedGate me={me} />;
  if (me.mfa_required) return <MFAGate me={me} />;

  const mobile = nav.filter((n) => MOBILE_PRIMARY.includes(n.key));
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="bg-primary text-primary-fg sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:fixed focus:start-2 focus:top-2"
      >
        {t("skip")}
      </a>
      <RealtimeBridge />
      <CommandPalette />

      <aside className="border-border bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e md:flex">
        <div className="px-4 pt-3 pb-2">
          <BrandLogo className="w-36" />
        </div>
        <nav aria-label={t("main")} className="flex flex-1 flex-col overflow-y-auto px-2 pb-2">
          <GroupedNav nav={nav} reviewAfter={reviewAfter} canReview={canReview} />
        </nav>
        <div className="border-border border-t p-2">
          <StreamStatus />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-surface/95 sticky top-0 z-30 h-14 border-b backdrop-blur">
          <div className="max-w-app mx-auto flex h-full w-full items-center gap-2 px-3 md:px-4">
            <ClientSwitcher />
            <div className="ms-auto flex items-center gap-1">
              <QuickAddLead />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>
        <OfflineBanner />
        {me?.agency?.sandbox_of && <SandboxBanner />}
        {me?.agency && <IncidentBanner />}
        {me?.read_only && (
          <p role="status" className="bg-warning-soft text-warning px-4 py-2 text-sm">
            {tShell("readOnly")}
          </p>
        )}
        <main id="main" className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <div className="max-w-app mx-auto w-full flex-1">{children}</div>
        </main>
      </div>

      <nav
        aria-label={t("main")}
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-30 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mobile.map((n) => (
          <NavLink key={n.key} item={n} compact />
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="text-muted flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
        >
          <Menu className="size-5" aria-hidden />
          {t("more")}
        </button>
      </nav>
      <LazySheet open={menuOpen} onOpenChange={setMenuOpen} title={t("more")} side="bottom">
        <nav className="flex flex-col p-3 pt-0">
          <GroupedNav nav={nav} reviewAfter={reviewAfter} canReview={canReview} onNavigate={() => setMenuOpen(false)} />
        </nav>
        <div className="border-border border-t p-3">
          <StreamStatus />
        </div>
      </LazySheet>
    </div>
  );
}
