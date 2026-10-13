"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";

import type { Listing } from "./api";

/** Built-in texts are translated by key; partner apps show what their publisher wrote. */
export function useListingText() {
  const t = useTranslations("marketplace.builtIn");
  return (l: Pick<Listing, "key" | "kind" | "summary" | "description">) => {
    if (l.kind !== "built_in") return { summary: l.summary, description: l.description };
    return {
      summary: t.has(`${l.key}.summary`) ? t(`${l.key}.summary`) : l.summary,
      description: t.has(`${l.key}.description`) ? t(`${l.key}.description`) : l.description,
    };
  };
}

/** A monogram tile in the brand palette (partner logos aren't hosted). */
export function AppMark({ name, kind, className }: { name: string; kind: Listing["kind"]; className?: string }) {
  const letters = name
    .split(/[\s&,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
        kind === "built_in" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent-strong",
        className,
      )}
    >
      {letters}
    </span>
  );
}

/** Read-only stars with the number for screen readers. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const t = useTranslations("marketplace");
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("ratingLabel", { n: value })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3.5", i <= Math.round(value) ? "fill-gold text-accent" : "text-border")}
        />
      ))}
    </span>
  );
}

/** A rating input: five radio buttons styled as stars. */
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useTranslations("marketplace");
  return (
    <div role="radiogroup" aria-label={t("yourRating")} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={t("stars", { n: i })}
          onClick={() => onChange(i)}
          className="hover:bg-accent-soft rounded-md p-1"
        >
          <Star aria-hidden className={cn("size-6", i <= value ? "fill-gold text-accent" : "text-border")} />
        </button>
      ))}
    </div>
  );
}
