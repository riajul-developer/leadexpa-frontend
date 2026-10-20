import { AlarmClock, Check, CheckCircle2, MessageCircle, Phone, Send, Sparkles, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/shared/lib/cn";

/** Ring draws a progress circle. */
function Ring({
  value,
  size = 50,
  stroke = 5,
  color,
  track,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

/** HeroVisual is the lead card, reply chip and revenue card composition. */
export async function HeroVisual() {
  const t = await getTranslations("marketing.hero.mock");
  return (
    <div role="img" aria-label={t("visual")} className="relative mx-auto h-[430px] w-full max-w-[500px] sm:h-[470px]">
      <svg
        aria-hidden
        viewBox="0 0 500 470"
        className="absolute inset-0 h-full w-full overflow-visible rtl:-scale-x-100"
        fill="none"
      >
        <defs>
          <linearGradient id="mk-swoosh" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#e6bd6e" stopOpacity="0" />
            <stop offset="0.5" stopColor="#e6bd6e" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f6dca6" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path d="M-40 440 C 180 430 300 380 380 270 S 470 60 492 20" stroke="url(#mk-swoosh)" strokeWidth="2.5" />
        <path
          d="M470 18 L496 16 L488 42"
          stroke="#f6dca6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mk-float-shadow absolute start-0 top-12 w-[86%] -rotate-2 rounded-[20px] bg-gradient-to-b from-[#fffdf9] to-[#f8f1e8] p-5 text-[#24121a] sm:w-[370px] rtl:rotate-2">
        <div className="flex items-center gap-2 text-[11.5px] font-bold tracking-wide text-[#9a6a3a] uppercase">
          <span className="grid size-5 place-items-center rounded-md bg-[#1877f2] text-[12px] font-extrabold text-white normal-case">
            f
          </span>
          {t("source")}
          <span className="ms-auto inline-flex items-center gap-1.5 text-[#b3261e]">
            <span className="mk-pulse size-[7px] rounded-full bg-[#e0372b] shadow-[0_0_0_4px_rgb(224_55_43/0.18)]" />
            {t("fresh")}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8f2347] to-[#c2492f] text-[16px] font-extrabold text-white shadow-[0_0_0_3px_#fff,0_0_0_5px_rgb(201_134_58/0.5)]">
            RU
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-extrabold">{t("name")}</span>
            <span className="block truncate text-[13px] text-[#806459]">{t("detail")}</span>
          </span>
          <span className="ms-auto">
            <Ring value={0.7} color="#2e9b55" track="#e7efe9">
              <span className="text-[11.5px] font-extrabold text-[#1d6b3a] tabular-nums">{t("timer")}</span>
            </Ring>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="inline-flex h-10 items-center justify-center gap-2 rounded-[11px] bg-gradient-to-b from-[#8f2347] to-[#7c1d3b] text-[13.5px] font-bold text-white shadow-[0_6px_14px_rgb(124_29_59/0.35)]">
            <Phone className="size-4" aria-hidden />
            {t("call")}
          </span>
          <span className="inline-flex h-10 items-center justify-center gap-2 rounded-[11px] bg-[#e7f6ec] text-[13.5px] font-bold text-[#1d6b3a]">
            <MessageCircle className="size-4" aria-hidden />
            {t("whatsapp")}
          </span>
        </div>
      </div>

      <div className="absolute end-1 top-0 z-10 inline-flex rotate-3 items-center gap-2 rounded-full bg-[#effaf2] py-2 ps-2 pe-4 text-[14px] font-extrabold text-[#17603a] shadow-[0_16px_34px_rgb(0_0_0/0.4)] rtl:-rotate-3">
        <span className="grid size-6 place-items-center rounded-full bg-gradient-to-b from-[#37b066] to-[#24894c]">
          <Check className="size-3.5 text-white" strokeWidth={3.2} aria-hidden />
        </span>
        {t("replied")}
      </div>

      <div className="mk-glass absolute end-0 bottom-0 w-[84%] rotate-[1.5deg] rounded-[20px] p-5 text-[var(--mk-ivory)] sm:w-[360px] rtl:-rotate-[1.5deg]">
        <div className="flex items-center justify-between text-[12.5px] font-semibold text-white/65">
          <span>{t("revenue")}</span>
          <span>{t("period")}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-3">
          <span className="text-[28px] font-extrabold tracking-tight tabular-nums">{t("amount")}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#7fe0a2]/25 bg-[#37b066]/15 px-2.5 py-1 text-[12.5px] font-extrabold text-[#8ee6ad]">
            {t("growth")}
          </span>
        </div>
        <svg
          aria-hidden
          viewBox="0 0 310 86"
          preserveAspectRatio="none"
          className="mt-2 block h-[80px] w-full overflow-visible"
        >
          <defs>
            <linearGradient id="mk-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e6bd6e" stopOpacity="0.5" />
              <stop offset="1" stopColor="#e6bd6e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 70 C 30 66 45 58 70 60 S 110 48 135 50 S 175 34 200 38 S 245 18 270 16 S 300 6 310 4 L 310 86 L 0 86 Z"
            fill="url(#mk-area)"
          />
          <path
            d="M0 70 C 30 66 45 58 70 60 S 110 48 135 50 S 175 34 200 38 S 245 18 270 16 S 300 6 310 4"
            fill="none"
            stroke="#f1cc88"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="310" cy="4" r="5" fill="#f6dca6" />
          <circle cx="310" cy="4" r="10" fill="#f6dca6" opacity="0.25" />
        </svg>
      </div>
    </div>
  );
}

/** MockFrame is the light panel a product preview sits in. */
export function MockFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-[var(--mk-line)] bg-gradient-to-br from-[#faf7f8] via-white to-[#f6f1ea] p-3 sm:p-10",
        className,
      )}
    >
      <div aria-hidden className="mk-grid-lines pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -end-24 -top-24 size-72 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -start-20 -bottom-24 size-72 rounded-full bg-[var(--mk-gold)]/20 blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

const SLA_TONE = {
  overdue: "bg-danger-soft text-danger",
  soon: "bg-warning-soft text-warning",
  track: "bg-surface-2 text-muted",
  met: "bg-success-soft text-success",
} as const;

/** InboxMock previews the SLA-sorted inbox. */
export async function InboxMock() {
  const t = await getTranslations("marketing.showcase.inbox.mock");
  const rows = [
    {
      name: t("a"),
      meta: t("aMeta"),
      sla: "overdue" as const,
      label: t("overdue"),
      initials: "NJ",
      hue: "from-[#8f2347] to-[#c2492f]",
    },
    {
      name: t("b"),
      meta: t("bMeta"),
      sla: "soon" as const,
      label: t("soon"),
      initials: "KA",
      hue: "from-[#b8862b] to-[#e6bd6e]",
    },
    {
      name: t("c"),
      meta: t("cMeta"),
      sla: "track" as const,
      label: t("track"),
      initials: "SI",
      hue: "from-[#1d5fa8] to-[#5b8fd1]",
    },
    {
      name: t("d"),
      meta: t("dMeta"),
      sla: "met" as const,
      label: t("met"),
      initials: "TH",
      hue: "from-[#13703a] to-[#3fa86a]",
    },
  ];
  return (
    <div className="mk-card-shadow overflow-hidden rounded-[18px] border border-[var(--mk-line)] bg-white">
      <div className="flex items-center gap-2 border-b border-[var(--mk-line)] px-5 py-3.5">
        <span className="text-[14.5px] font-bold">{t("title")}</span>
        <span className="bg-danger ms-1 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white">
          1
        </span>
        <span className="ms-auto flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#e3e3e9]" />
          <span className="size-2.5 rounded-full bg-[#e3e3e9]" />
          <span className="size-2.5 rounded-full bg-[#e3e3e9]" />
        </span>
      </div>
      <ul className="divide-y divide-[var(--mk-line)]">
        {rows.map((r) => (
          <li
            key={r.initials}
            className={cn("flex items-center gap-3 px-4 py-3.5 sm:px-5", r.sla === "overdue" && "bg-danger-soft/40")}
          >
            <span
              className={cn(
                "hidden size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[13px] font-bold text-white min-[420px]:grid",
                r.hue,
              )}
            >
              {r.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">{r.name}</span>
              <span className="text-muted block truncate text-[12.5px]">{r.meta}</span>
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums",
                SLA_TONE[r.sla],
              )}
            >
              {r.sla === "met" ? (
                <CheckCircle2 className="size-3.5" aria-hidden />
              ) : (
                <AlarmClock className="size-3.5" aria-hidden />
              )}
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** AiMock previews a lead message and the AI's draft reply. */
export async function AiMock() {
  const t = await getTranslations("marketing.showcase.ai.mock");
  return (
    <div className="grid gap-4">
      <div
        className="mk-card-shadow max-w-[86%] rounded-[18px] rounded-ss-md border border-[var(--mk-line)] bg-white px-4 py-3 text-[15px] leading-relaxed"
        dir="auto"
      >
        {t("lead")}
      </div>
      <div className="mk-card-shadow border-primary/15 ms-auto w-[94%] rounded-[18px] border bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#8f2347] to-[#b8862b] text-white">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <span className="text-primary text-[13px] font-bold">{t("draftLabel")}</span>
          <span className="bg-warning-soft text-warning ms-auto rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold">
            {t("level")}
          </span>
        </div>
        <p className="bg-surface-2/70 mt-3 rounded-xl px-3.5 py-3 text-[15px] leading-relaxed" dir="auto">
          {t("draft")}
        </p>
        <div className="mt-3 flex gap-2">
          <span className="bg-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white">
            <Send className="size-3.5 rtl:-scale-x-100" aria-hidden />
            {t("approve")}
          </span>
          <span className="border-border inline-flex h-9 items-center rounded-lg border px-3.5 text-[13px] font-semibold">
            {t("edit")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** RevenueMock previews revenue by campaign with ROAS. */
export async function RevenueMock() {
  const t = await getTranslations("marketing.showcase.revenue.mock");
  const rows = [
    { name: t("a"), value: t("aValue"), roas: t("aRoas"), w: "w-full" },
    { name: t("b"), value: t("bValue"), roas: t("bRoas"), w: "w-[66%]" },
    { name: t("c"), value: t("cValue"), roas: t("cRoas"), w: "w-[30%]" },
  ];
  return (
    <div className="grid gap-4">
      <div className="mk-card-shadow rounded-[18px] border border-[var(--mk-line)] bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-[14.5px] font-bold">{t("title")}</span>
          <span className="text-muted text-[12px] font-semibold">{t("roas")}</span>
        </div>
        <ul className="mt-4 grid gap-4">
          {rows.map((r) => (
            <li key={r.name} className="grid gap-1.5">
              <div className="flex items-center gap-3 text-[13.5px]">
                <span className="font-semibold">{r.name}</span>
                <span className="text-muted ms-auto font-semibold tabular-nums">{r.value}</span>
                <span className="bg-success-soft text-success w-14 rounded-full py-0.5 text-center text-[12px] font-bold tabular-nums">
                  {r.roas}
                </span>
              </div>
              <div className="bg-surface-2 h-2.5 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-[#7c1d3b] to-[#b8862b] rtl:bg-gradient-to-l",
                    r.w,
                  )}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mk-card-shadow ms-auto inline-flex items-center gap-2.5 rounded-full border border-[var(--mk-line)] bg-white py-2 ps-2 pe-4 text-[13.5px] font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-[#1877f2] text-[13px] font-extrabold text-white">
          f
        </span>
        {t("sent")}
        <CheckCircle2 className="text-success size-4" aria-hidden />
      </div>
    </div>
  );
}

/** ReportMock previews a client's white-label portal. */
export async function ReportMock() {
  const t = await getTranslations("marketing.showcase.reports.mock");
  const kpis = [
    { label: t("leads"), value: t("leadsValue") },
    { label: t("reply"), value: t("replyValue") },
    { label: t("sales"), value: t("salesValue") },
  ];
  return (
    <div className="mk-card-shadow overflow-hidden rounded-[18px] border border-[var(--mk-line)] bg-white">
      <div className="flex items-center gap-2.5 bg-[#0f2a4a] px-5 py-3.5 text-white">
        <span className="grid size-7 place-items-center rounded-lg bg-white/15 text-[12px] font-extrabold">B</span>
        <span className="text-[14px] font-bold">{t("brand")}</span>
      </div>
      <div className="p-5">
        <p className="text-muted text-[13px] font-semibold">{t("client")}</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="bg-surface-2/70 rounded-xl px-2.5 py-3 sm:px-3">
              <p className="text-muted truncate text-[11.5px] font-medium">{k.label}</p>
              <p className="mt-1 text-[16px] font-extrabold tracking-tight whitespace-nowrap tabular-nums sm:text-[19px]">
                {k.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-[var(--mk-line)] p-3.5">
          <Ring value={0.86} size={56} stroke={6} color="#13703a" track="#e6f4ec">
            <span className="text-[14px] font-extrabold text-[#13703a] tabular-nums">{t("healthValue")}</span>
          </Ring>
          <span className="text-[14px] font-semibold">{t("health")}</span>
          <TrendingUp className="text-success ms-auto size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}
