import { Check, ChevronDown, Globe, Menu, X } from "lucide-react";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAMES } from "@/shared/config/locales";
import { CSRF_COOKIE } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";

import { DismissibleDetails } from "./dismissible-details";
import { Container } from "./primitives";

const NAV = [
  { key: "how", href: "/#how" },
  { key: "features", href: "/features" },
  { key: "pricing", href: "/#pricing" },
  { key: "faq", href: "/#faq" },
] as const;

const SITE_LOCALES = LOCALES.filter((l) => l !== "en-XA");

/** Logo renders the original brand logo at full resolution. */
function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/leadexpa-logo.png"
      alt=""
      width={720}
      height={211}
      decoding="async"
      className={cn("h-auto max-w-none select-none", className)}
      draggable={false}
    />
  );
}

/** LanguageMenu is a dropdown that switches locale, keeping the path. */
async function LanguageMenu({ path, up }: { path: string; up?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("marketing.nav");
  return (
    <DismissibleDetails className="group relative">
      <summary
        aria-label={t("language")}
        className={cn(
          "flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-[14px] font-medium transition-colors [&::-webkit-details-marker]:hidden",
          "text-text/75 hover:bg-surface-2 hover:text-text",
        )}
      >
        <Globe className="size-4" aria-hidden />
        <span lang={locale}>{LOCALE_NAMES[locale as (typeof SITE_LOCALES)[number]]}</span>
        <ChevronDown
          className="size-3.5 opacity-60 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul
        className={cn(
          "absolute end-0 z-10 grid w-max min-w-28 gap-0.5 rounded-xl border p-1",
          up ? "bottom-12" : "top-12",
          "border-[var(--mk-line)] bg-white shadow-[0_18px_40px_-12px_rgb(24_22_34/0.25)]",
        )}
      >
        {SITE_LOCALES.map((l) => (
          <li key={l}>
            <Link
              href={path}
              locale={l}
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[14px] transition-colors",
                "text-text/85 hover:bg-surface-2",
                l === locale && "text-primary font-semibold",
              )}
            >
              {LOCALE_NAMES[l]}
              {l === locale && <Check className="size-4" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </DismissibleDetails>
  );
}

/** SiteHeader is the sticky marketing header. */
export async function SiteHeader({ path }: { path: string }) {
  const t = await getTranslations("marketing.nav");
  const locale = await getLocale();
  const signedIn = (await cookies()).has(CSRF_COOKIE);
  const primary = signedIn ? { href: "/inbox", label: t("openApp") } : { href: "/signup", label: t("start") };
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--mk-line)] bg-white/90 backdrop-blur-xl backdrop-saturate-150">
      <Container className="grid h-[72px] grid-cols-[auto_1fr] items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" aria-label={t("home")} className="justify-self-start">
          <Logo className="w-[150px] sm:w-[172px]" />
        </Link>
        <nav aria-label={t("menu")} className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className="text-text/70 hover:bg-surface-2 hover:text-text rounded-lg px-4 py-2 text-[15px] font-medium transition-colors"
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 justify-self-end lg:flex">
          <LanguageMenu path={path} />
          {!signedIn && (
            <Link href="/login" className="text-text/80 hover:text-text px-3 text-[15px] font-medium transition-colors">
              {t("signIn")}
            </Link>
          )}
          <Link
            href={primary.href}
            className="hover:to-primary-hover to-primary inline-flex h-10 items-center rounded-lg bg-gradient-to-b from-[#8f2347] px-4 text-[14.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgb(124_29_59/0.7),inset_0_1px_0_rgb(255_255_255/0.18)] transition-colors"
          >
            {primary.label}
          </Link>
        </div>
        <DismissibleDetails className="mk-menu relative justify-self-end lg:hidden">
          <summary
            aria-label={t("menu")}
            className="text-text hover:bg-surface-2 grid size-10 cursor-pointer list-none place-items-center rounded-lg [&::-webkit-details-marker]:hidden"
          >
            <Menu className="mk-menu-open size-5" aria-hidden />
            <X className="mk-menu-close size-5" aria-hidden />
          </summary>
          <div className="absolute end-0 top-12 w-[min(88vw,320px)] rounded-2xl border border-[var(--mk-line)] bg-white p-3 shadow-[0_24px_60px_-16px_rgb(24_22_34/0.35)]">
            <nav aria-label={t("menu")} className="grid">
              {NAV.map((n) => (
                <Link
                  key={n.key}
                  href={n.href}
                  className="text-text/85 hover:bg-surface-2 rounded-lg px-3 py-2.5 text-[15px] font-medium"
                >
                  {t(n.key)}
                </Link>
              ))}
            </nav>
            <div className="my-2 h-px bg-[var(--mk-line)]" />
            <nav aria-label={t("language")} className="grid grid-cols-3 gap-1">
              {SITE_LOCALES.map((l) => (
                <Link
                  key={l}
                  href={path}
                  locale={l}
                  lang={l}
                  aria-current={l === locale ? "true" : undefined}
                  className={cn(
                    "grid h-9 place-items-center rounded-lg text-[13.5px] font-medium",
                    l === locale ? "bg-primary-soft text-primary" : "text-text/70 hover:bg-surface-2",
                  )}
                >
                  {LOCALE_NAMES[l]}
                </Link>
              ))}
            </nav>
            <div className="mt-3 grid gap-2">
              <Link
                href={primary.href}
                className="bg-primary grid h-11 place-items-center rounded-lg text-[14.5px] font-semibold text-white"
              >
                {primary.label}
              </Link>
              {!signedIn && (
                <Link
                  href="/login"
                  className="border-border text-text grid h-11 place-items-center rounded-lg border text-[14.5px] font-medium"
                >
                  {t("signIn")}
                </Link>
              )}
            </div>
          </div>
        </DismissibleDetails>
      </Container>
    </header>
  );
}

/** SiteFooter lists the marketing and account links. */
export async function SiteFooter({ path }: { path: string }) {
  const t = await getTranslations("marketing");
  const columns = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.how"), href: "/#how" },
        { label: t("nav.features"), href: "/features" },
        { label: t("nav.pricing"), href: "/#pricing" },
        { label: t("nav.faq"), href: "/#faq" },
      ],
    },
    {
      title: t("footer.account"),
      links: [
        { label: t("nav.start"), href: "/signup" },
        { label: t("nav.signIn"), href: "/login" },
      ],
    },
    {
      title: t("footer.trust"),
      links: [
        { label: t("footer.security"), href: "/#security" },
        { label: t("footer.status"), href: "/status" },
      ],
    },
  ];
  return (
    <footer className="border-t border-[var(--mk-line)] bg-[#fbfafb]">
      <Container className="relative grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="grid content-start gap-4">
          <Logo className="w-[176px]" />
          <p className="text-muted max-w-[300px] text-[14.5px] leading-relaxed">{t("footer.tagline")}</p>
        </div>
        {columns.map((c) => (
          <div key={c.title} className="grid content-start gap-3">
            <p className="text-text text-[13px] font-semibold">{c.title}</p>
            <ul className="grid gap-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted hover:text-primary text-[14.5px] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container className="relative">
        <div className="flex flex-col gap-4 border-t border-[var(--mk-line)] py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted text-[13px]">{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <LanguageMenu path={path} up />
        </div>
      </Container>
    </footer>
  );
}
