import {
  Activity,
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  CodeXml,
  Coins,
  CreditCard,
  FlaskConical,
  Fingerprint,
  Globe,
  HeartPulse,
  Hourglass,
  Inbox,
  KeyRound,
  Languages,
  Mail,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  Repeat,
  Route,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Unplug,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cn } from "@/shared/lib/cn";

import { AiMock, HeroVisual, InboxMock, MockFrame, ReportMock, RevenueMock } from "./mockups";
import { CheckList, Container, Eyebrow, PrimaryCta, SecondaryCta, SectionHeading } from "./primitives";

/** Hero is the dark opening section. */
async function Hero() {
  const t = await getTranslations("marketing.hero");
  const stats = ["one", "two", "three"] as const;
  return (
    <section className="mk-dark relative overflow-hidden">
      <div aria-hidden className="mk-grain pointer-events-none absolute inset-0" />
      <div aria-hidden className="mk-dots pointer-events-none absolute inset-0" />
      <Container className="relative grid items-center gap-14 pt-16 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-24 lg:pb-28">
        <div className="grid justify-items-start gap-6">
          <Eyebrow tone="dark">{t("eyebrow")}</Eyebrow>
          <h1 className="mk-display text-[42px] leading-[1.04] font-extrabold text-[var(--mk-ivory)] sm:text-[56px] lg:text-[64px]">
            {t("titleStart")}
            <span className="mk-gold-text">{t("titleHighlight")}</span>
            {t("titleEnd")}
          </h1>
          <p className="max-w-[540px] text-[17.5px] leading-relaxed text-white/70 sm:text-[18.5px]">{t("sub")}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <PrimaryCta
              href="/signup"
              className="from-[#f6dca6] to-[#e6bd6e] text-[var(--mk-ink)] shadow-[0_12px_30px_-10px_rgb(230_189_110/0.6),inset_0_1px_0_rgb(255_255_255/0.5)] hover:to-[#ecc77f] hover:shadow-[0_16px_34px_-10px_rgb(230_189_110/0.7),inset_0_1px_0_rgb(255_255_255/0.5)]"
            >
              {t("primary")}
            </PrimaryCta>
            <SecondaryCta href="/#how" tone="dark">
              {t("secondary")}
            </SecondaryCta>
          </div>
          <p className="text-[13.5px] text-white/50">{t("note")}</p>
          <dl className="mt-2 grid w-full max-w-[560px] grid-cols-3 border-t border-white/10 pt-6">
            {stats.map((s, i) => (
              <div key={s} className={cn("grid gap-1 pe-3", i > 0 && "border-s border-white/10 ps-4 sm:ps-6")}>
                <dt className="order-2 text-[12.5px] leading-snug text-white/55">{t(`stats.${s}.label`)}</dt>
                <dd className="mk-display order-1 text-[18px] font-extrabold text-[var(--mk-ivory)] sm:text-[22px]">
                  {t(`stats.${s}.value`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroVisual />
      </Container>
    </section>
  );
}

const CHANNELS: { key: string; icon: LucideIcon }[] = [
  { key: "meta", icon: Megaphone },
  { key: "google", icon: Search },
  { key: "whatsapp", icon: MessageCircle },
  { key: "social", icon: MessagesSquare },
  { key: "web", icon: Globe },
  { key: "email", icon: Mail },
  { key: "calls", icon: Phone },
  { key: "api", icon: CodeXml },
];

/** Channels lists the lead sources. */
async function Channels() {
  const t = await getTranslations("marketing.channels");
  return (
    <section className="border-b border-[var(--mk-line)] bg-white">
      <Container className="grid gap-7 py-12 text-center">
        <p className="text-muted mx-auto max-w-[560px] text-[15px] font-medium">{t("title")}</p>
        <ul className="flex flex-wrap justify-center gap-2.5">
          {CHANNELS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="text-text/80 inline-flex items-center gap-2 rounded-full border border-[var(--mk-line)] bg-white px-4 py-2 text-[14px] font-semibold shadow-[0_1px_2px_rgb(24_22_34/0.04)]"
            >
              <Icon className="text-primary size-4" aria-hidden />
              {t(`items.${key}`)}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Problem explains where agencies lose money. */
async function Problem() {
  const t = await getTranslations("marketing.problem");
  const items: { key: string; icon: LucideIcon }[] = [
    { key: "slow", icon: Hourglass },
    { key: "scattered", icon: Unplug },
    { key: "proof", icon: TrendingUp },
  ];
  return (
    <section className="bg-[#fbfafb] py-20 sm:py-28">
      <Container className="grid gap-14">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />
        <div className="grid gap-5 md:grid-cols-3">
          {items.map(({ key, icon: Icon }, i) => (
            <article
              key={key}
              className="mk-card-shadow relative grid content-start gap-4 rounded-[22px] border border-[var(--mk-line)] bg-white p-7"
            >
              <span
                aria-hidden
                data-n={`0${i + 1}`}
                className="mk-step-num mk-display text-primary/10 absolute end-6 top-4 text-[56px] leading-none font-extrabold"
              />
              <span className="bg-danger-soft text-danger grid size-11 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mk-display text-[20px] font-bold">{t(`items.${key}.title`)}</h3>
              <p className="text-muted text-[15.5px] leading-relaxed">{t(`items.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** HowItWorks shows the four steps. */
async function HowItWorks() {
  const t = await getTranslations("marketing.how");
  const steps: { key: string; icon: LucideIcon }[] = [
    { key: "capture", icon: Inbox },
    { key: "route", icon: Route },
    { key: "respond", icon: Zap },
    { key: "prove", icon: BadgeCheck },
  ];
  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <Container className="grid gap-16">
        <SectionHeading id="how-h" eyebrow={t("eyebrow")} title={t("title")} />
        <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
          <span
            aria-hidden
            className="from-primary/0 via-primary/30 to-primary/0 absolute start-[12%] end-[12%] top-7 hidden h-px bg-gradient-to-r md:block"
          />
          {steps.map(({ key, icon: Icon }, i) => (
            <li key={key} className="relative grid justify-items-center gap-4 text-center">
              <span className="to-primary relative grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-[#8f2347] text-white shadow-[0_12px_26px_-10px_rgb(124_29_59/0.7)]">
                <Icon className="size-6" aria-hidden />
                <span className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full bg-[var(--mk-gold)] text-[12px] font-extrabold text-[var(--mk-ink)] ring-4 ring-white">
                  {i + 1}
                </span>
              </span>
              <h3 className="mk-display text-[19px] font-bold">{t(`steps.${key}.title`)}</h3>
              <p className="text-muted max-w-[260px] text-[15px] leading-relaxed">{t(`steps.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/** Showcase alternates feature stories with product previews. */
async function Showcase() {
  const t = await getTranslations("marketing.showcase");
  const rows = [
    { key: "inbox", mock: <InboxMock /> },
    { key: "ai", mock: <AiMock /> },
    { key: "revenue", mock: <RevenueMock /> },
    { key: "reports", mock: <ReportMock /> },
  ] as const;
  return (
    <section id="product" className="bg-[#fbfafb] py-20 sm:py-28">
      <Container className="grid gap-24 sm:gap-32">
        {rows.map((r, i) => (
          <div key={r.key} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className={cn("grid gap-6", i % 2 === 1 && "lg:order-2")}>
              <SectionHeading
                align="start"
                eyebrow={t(`${r.key}.eyebrow`)}
                title={t(`${r.key}.title`)}
                sub={t(`${r.key}.body`)}
              />
              <CheckList items={[t(`${r.key}.points.one`), t(`${r.key}.points.two`), t(`${r.key}.points.three`)]} />
            </div>
            <MockFrame className={cn(i % 2 === 1 && "lg:order-1")}>{r.mock}</MockFrame>
          </div>
        ))}
      </Container>
    </section>
  );
}

const GRID: { key: string; icon: LucideIcon }[] = [
  { key: "sequences", icon: Repeat },
  { key: "automation", icon: Workflow },
  { key: "routing", icon: Route },
  { key: "booking", icon: CalendarCheck },
  { key: "payments", icon: CreditCard },
  { key: "crm", icon: RefreshCw },
  { key: "inbox", icon: MessagesSquare },
  { key: "calls", icon: PhoneCall },
  { key: "team", icon: Users },
  { key: "ask", icon: Sparkles },
  { key: "health", icon: HeartPulse },
  { key: "sandbox", icon: FlaskConical },
];

/** FeatureGrid summarises the rest of the platform. */
async function FeatureGrid() {
  const t = await getTranslations("marketing.grid");
  return (
    <section id="features" aria-labelledby="grid-h" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <Container className="grid gap-14">
        <SectionHeading id="grid-h" eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />
        <ul className="grid gap-px overflow-hidden rounded-[24px] border border-[var(--mk-line)] bg-[var(--mk-line)] sm:grid-cols-2 lg:grid-cols-4">
          {GRID.map(({ key, icon: Icon }) => (
            <li key={key} className="group grid content-start gap-3 bg-white p-6 transition-colors hover:bg-[#fcfafb]">
              <span className="bg-primary-soft text-primary grid size-10 place-items-center rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <h3 className="text-[16px] font-bold">{t(`items.${key}.title`)}</h3>
              <p className="text-muted text-[14.5px] leading-relaxed">{t(`items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
        <div className="flex justify-center">
          <SecondaryCta href="/features">{t("all")}</SecondaryCta>
        </div>
      </Container>
    </section>
  );
}

/** GlobalReady covers languages, currencies, regions and mobile. */
async function GlobalReady() {
  const t = await getTranslations("marketing.global");
  const items: { key: string; icon: LucideIcon }[] = [
    { key: "languages", icon: Languages },
    { key: "money", icon: Coins },
    { key: "regions", icon: Server },
    { key: "mobile", icon: Smartphone },
  ];
  return (
    <section className="mk-dark relative overflow-hidden py-20 sm:py-28">
      <div aria-hidden className="mk-grain pointer-events-none absolute inset-0" />
      <Container className="relative grid gap-14">
        <SectionHeading tone="dark" eyebrow={t("eyebrow")} title={t("title")} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ key, icon: Icon }) => (
            <article
              key={key}
              className="grid content-start gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-6"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--mk-gold)]/15 text-[var(--mk-gold)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-[17px] font-bold text-[var(--mk-ivory)]">{t(`items.${key}.title`)}</h3>
              <p className="text-[14.5px] leading-relaxed text-white/60">{t(`items.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** Security lists the enterprise controls. */
async function Security() {
  const t = await getTranslations("marketing.security");
  const items: { key: string; icon: LucideIcon }[] = [
    { key: "mfa", icon: Fingerprint },
    { key: "sso", icon: KeyRound },
    { key: "keys", icon: ShieldCheck },
    { key: "audit", icon: ScrollText },
    { key: "uptime", icon: Activity },
    { key: "status", icon: Server },
  ];
  return (
    <section id="security" aria-labelledby="security-h" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <SectionHeading id="security-h" align="start" eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="mk-card-shadow flex items-center gap-3.5 rounded-2xl border border-[var(--mk-line)] bg-white p-4"
            >
              <span className="bg-success-soft text-success grid size-10 shrink-0 place-items-center rounded-xl">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="text-[14.5px] leading-snug font-semibold">{t(`items.${key}`)}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

const PLANS = [
  { key: "starter", features: ["one", "two", "three", "four"], featured: false },
  { key: "growth", features: ["one", "two", "three", "four", "five", "six"], featured: true },
  { key: "pro", features: ["one", "two", "three", "four", "five", "six"], featured: false },
] as const;

/** Pricing shows the three public plans. */
async function Pricing() {
  const t = await getTranslations("marketing.pricing");
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-20 bg-[#fbfafb] py-20 sm:py-28">
      <Container className="grid gap-14">
        <SectionHeading id="pricing-h" eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <article
              key={p.key}
              className={cn(
                "relative grid content-start gap-6 rounded-[24px] p-7 sm:p-8",
                p.featured
                  ? "mk-dark shadow-[0_30px_60px_-20px_rgb(43_13_28/0.55)] lg:-my-3 lg:py-11"
                  : "mk-card-shadow border border-[var(--mk-line)] bg-white",
              )}
            >
              {p.featured && (
                <span className="absolute start-7 -top-3 rounded-full bg-gradient-to-r from-[#f6dca6] to-[#e6bd6e] px-3 py-1 text-[12px] font-bold text-[var(--mk-ink)] shadow-[0_6px_16px_-6px_rgb(230_189_110/0.7)]">
                  {t("popular")}
                </span>
              )}
              <div className="grid gap-1.5">
                <h3 className={cn("mk-display text-[20px] font-bold", p.featured && "text-[var(--mk-ivory)]")}>
                  {t(`plans.${p.key}.name`)}
                </h3>
                <p className={cn("text-[14.5px]", p.featured ? "text-white/60" : "text-muted")}>
                  {t(`plans.${p.key}.desc`)}
                </p>
              </div>
              <p className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "mk-display text-[44px] leading-none font-extrabold tabular-nums",
                    p.featured && "mk-gold-text",
                  )}
                >
                  {t(`plans.${p.key}.price`)}
                </span>
                <span className={cn("text-[15px] font-medium", p.featured ? "text-white/55" : "text-muted")}>
                  {t("per")}
                </span>
              </p>
              <Link
                href="/signup"
                className={cn(
                  "grid h-12 place-items-center rounded-xl text-[15px] font-semibold transition-colors",
                  p.featured
                    ? "bg-[var(--mk-ivory)] text-[var(--mk-ink)] hover:bg-white"
                    : "bg-primary hover:bg-primary-hover text-white",
                )}
              >
                {t("cta")}
              </Link>
              <div className={cn("h-px", p.featured ? "bg-white/10" : "bg-[var(--mk-line)]")} />
              <CheckList
                tone={p.featured ? "dark" : "light"}
                items={p.features.map((f) => t(`plans.${p.key}.features.${f}`))}
              />
            </article>
          ))}
        </div>
        <p className="text-muted mx-auto max-w-[620px] text-center text-[13.5px]">{t("note")}</p>
      </Container>
    </section>
  );
}

/** Faq answers common questions without client JavaScript. */
async function Faq() {
  const t = await getTranslations("marketing.faq");
  const items = ["channels", "language", "ai", "clients", "data", "trial"] as const;
  return (
    <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading id="faq-h" align="start" eyebrow={t("eyebrow")} title={t("title")} />
        </div>
        <div className="grid gap-3">
          {items.map((k, i) => (
            <details
              key={k}
              open={i === 0}
              className="mk-faq group rounded-2xl border border-[var(--mk-line)] bg-white open:bg-[#fcfafb] open:shadow-[0_1px_2px_rgb(24_22_34/0.04)]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 text-[16px] font-semibold sm:px-6">
                {t(`items.${k}.q`)}
                <ChevronDown
                  className="mk-faq-icon text-muted ms-auto size-5 shrink-0 transition-transform duration-200"
                  aria-hidden
                />
              </summary>
              <p className="text-muted px-5 pb-5 text-[15.5px] leading-relaxed sm:px-6">{t(`items.${k}.a`)}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** FinalCta closes the page with the trial offer. */
export async function FinalCta() {
  const t = await getTranslations("marketing.cta");
  return (
    <section className="bg-white pb-20 sm:pb-28">
      <Container>
        <div className="mk-dark relative overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="mk-grain pointer-events-none absolute inset-0" />
          <div aria-hidden className="mk-dots pointer-events-none absolute inset-0" />
          <div className="relative mx-auto grid max-w-[640px] justify-items-center gap-5">
            <h2 className="mk-display text-[32px] leading-[1.1] font-extrabold text-[var(--mk-ivory)] sm:text-[46px]">
              {t("title")}
            </h2>
            <p className="text-[17px] leading-relaxed text-white/65">{t("sub")}</p>
            <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <PrimaryCta
                href="/signup"
                className="from-[#f6dca6] to-[#e6bd6e] text-[var(--mk-ink)] shadow-[0_12px_30px_-10px_rgb(230_189_110/0.6),inset_0_1px_0_rgb(255_255_255/0.5)] hover:to-[#ecc77f]"
              >
                {t("primary")}
              </PrimaryCta>
              <SecondaryCta href="/login" tone="dark">
                {t("secondary")}
              </SecondaryCta>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/** LandingPage is the public home page. */
export function LandingPage() {
  return (
    <main id="main">
      <Hero />
      <Channels />
      <Problem />
      <HowItWorks />
      <Showcase />
      <FeatureGrid />
      <GlobalReady />
      <Security />
      <Pricing />
      <Faq />
      <FinalCta />
    </main>
  );
}
