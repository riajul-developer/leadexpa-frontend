import {
  Bot,
  Briefcase,
  Globe,
  Inbox,
  Plug,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { FinalCta } from "./landing-page";
import { Container, Eyebrow } from "./primitives";

const GROUPS: { key: string; icon: LucideIcon; items: string[] }[] = [
  { key: "capture", icon: Inbox, items: ["sources", "quality", "consent", "api"] },
  { key: "respond", icon: Zap, items: ["sla", "inbox", "autoreply", "calls", "links"] },
  { key: "automate", icon: Workflow, items: ["sequences", "rules", "routing", "booking"] },
  { key: "ai", icon: Bot, items: ["drafts", "agent", "scoring", "ask"] },
  { key: "revenue", icon: TrendingUp, items: ["sales", "attribution", "conversions", "payments"] },
  { key: "clients", icon: Briefcase, items: ["portal", "reports", "reviews", "health"] },
  { key: "team", icon: Users, items: ["wallboard", "coaching", "lite", "sandbox"] },
  { key: "integrations", icon: Plug, items: ["crm", "marketplace", "warehouse", "developer"] },
  { key: "security", icon: ShieldCheck, items: ["mfa", "sso", "encryption", "audit"] },
  { key: "global", icon: Globe, items: ["languages", "currencies", "regions", "status"] },
];

/** FeaturesPage lists every capability, grouped. */
export async function FeaturesPage() {
  const t = await getTranslations("marketing.features");
  return (
    <main id="main">
      <section className="mk-dark relative overflow-hidden">
        <div aria-hidden className="mk-grain pointer-events-none absolute inset-0" />
        <div aria-hidden className="mk-dots pointer-events-none absolute inset-0" />
        <Container className="relative grid justify-items-center gap-5 py-20 text-center sm:py-24">
          <Eyebrow tone="dark">{t("eyebrow")}</Eyebrow>
          <h1 className="mk-display max-w-[760px] text-[38px] leading-[1.08] font-extrabold text-[var(--mk-ivory)] sm:text-[54px]">
            {t("title")}
          </h1>
          <p className="max-w-[600px] text-[17.5px] leading-relaxed text-white/65">{t("sub")}</p>
          <nav aria-label={t("eyebrow")} className="mt-4 flex max-w-[860px] flex-wrap justify-center gap-2">
            {GROUPS.map(({ key, icon: Icon }) => (
              <Link
                key={key}
                href={`/features#${key}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[13.5px] font-medium text-white/75 transition-colors hover:border-white/25 hover:text-white"
              >
                <Icon className="size-3.5 text-[var(--mk-gold)]" aria-hidden />
                {t(`groups.${key}.title`)}
              </Link>
            ))}
          </nav>
        </Container>
      </section>
      <section className="bg-[#fbfafb] py-16 sm:py-24">
        <Container className="grid gap-16 sm:gap-20">
          {GROUPS.map(({ key, icon: Icon, items }) => (
            <section
              key={key}
              id={key}
              aria-labelledby={`${key}-h`}
              className="grid scroll-mt-24 gap-6 lg:grid-cols-[260px_1fr] lg:gap-12"
            >
              <div className="flex items-center gap-3 lg:sticky lg:top-24 lg:self-start">
                <span className="to-primary grid size-11 place-items-center rounded-xl bg-gradient-to-b from-[#8f2347] text-white shadow-[0_10px_22px_-10px_rgb(124_29_59/0.7)]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 id={`${key}-h`} className="mk-display text-[24px] font-extrabold">
                  {t(`groups.${key}.title`)}
                </h2>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {items.map((item) => (
                  <li
                    key={item}
                    className="mk-card-shadow grid content-start gap-2 rounded-[20px] border border-[var(--mk-line)] bg-white p-6"
                  >
                    <h3 className="text-[16.5px] font-bold">{t(`groups.${key}.items.${item}.title`)}</h3>
                    <p className="text-muted text-[15px] leading-relaxed">{t(`groups.${key}.items.${item}.body`)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Container>
      </section>
      <div className="bg-[#fbfafb] pt-4">
        <FinalCta />
      </div>
    </main>
  );
}
