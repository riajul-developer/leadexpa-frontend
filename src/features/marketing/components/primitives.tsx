import { ArrowRight, Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/shared/lib/cn";

/** Container centres content at the marketing width. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)}>{children}</div>;
}

/** Eyebrow is the small label above a section title. */
export function Eyebrow({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <p
      className={cn(
        "mk-eyebrow inline-flex items-center gap-2.5 text-[12.5px] font-bold uppercase",
        tone === "dark" ? "text-[var(--mk-gold)]" : "text-primary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-0.5 w-6 rounded-full",
          tone === "dark"
            ? "bg-gradient-to-r from-transparent to-[var(--mk-gold)] rtl:bg-gradient-to-l"
            : "from-primary/0 to-primary bg-gradient-to-r rtl:bg-gradient-to-l",
        )}
      />
      {children}
    </p>
  );
}

/** SectionHeading renders an eyebrow, title and optional lead paragraph. */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  tone = "light",
  id,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "start";
  tone?: "light" | "dark";
  id?: string;
}) {
  return (
    <div
      className={cn(
        "grid content-start gap-4",
        align === "center" ? "mx-auto max-w-[720px] justify-items-center text-center" : "max-w-[560px]",
      )}
    >
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className={cn(
          "mk-display text-[30px] leading-[1.12] font-extrabold sm:text-[42px]",
          tone === "dark" ? "text-[var(--mk-ivory)]" : "text-text",
        )}
      >
        {title}
      </h2>
      {sub && (
        <p className={cn("text-[17px] leading-relaxed", tone === "dark" ? "text-white/65" : "text-muted")}>{sub}</p>
      )}
    </div>
  );
}

/** PrimaryCta is the wine call-to-action link. */
export function PrimaryCta({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white",
        "to-primary bg-gradient-to-b from-[#8f2347] shadow-[0_10px_24px_-8px_rgb(124_29_59/0.65),inset_0_1px_0_rgb(255_255_255/0.18)]",
        "hover:to-primary-hover transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_14px_30px_-8px_rgb(124_29_59/0.7),inset_0_1px_0_rgb(255_255_255/0.18)]",
        className,
      )}
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/** SecondaryCta is the outlined link, for light or dark backgrounds. */
export function SecondaryCta({
  href,
  children,
  tone = "light",
  className,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition-colors duration-200",
        tone === "dark"
          ? "border border-white/20 bg-white/[0.06] text-[var(--mk-ivory)] hover:border-white/35 hover:bg-white/10"
          : "border-border text-text hover:bg-surface-2 border bg-white",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** CheckList renders short points with check marks. */
export function CheckList({ items, tone = "light" }: { items: string[]; tone?: "light" | "dark" }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15.5px] leading-relaxed">
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
              tone === "dark" ? "bg-[var(--mk-gold)]/20 text-[var(--mk-gold)]" : "bg-primary-soft text-primary",
            )}
          >
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          <span className={tone === "dark" ? "text-white/80" : "text-text/85"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
