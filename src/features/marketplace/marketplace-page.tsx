"use client";

import { CheckCircle2, Search, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/input";
import { Badge, Card, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type Category, useListings } from "./api";
import { AppMark, Stars, useListingText } from "./parts";

/** /marketplace: every integration and partner app, by category, with ratings. */
export function MarketplacePage() {
  const t = useTranslations("marketplace");
  const tc = useTranslations("marketplace.categories");
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const { data, isPending } = useListings(category, query);
  const text = useListingText();
  const listings = data?.data ?? [];
  const categories = data?.categories ?? [];
  return (
    <div className="mx-auto grid max-w-6xl gap-5 p-4">
      <header className="rounded-card border-border bg-surface relative overflow-hidden border p-5">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
        <div aria-hidden className="bg-gold/25 absolute -end-16 -top-20 size-56 rounded-full blur-3xl" />
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Store className="text-accent size-6" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">{t("intro")}</p>
        <div className="relative mt-4 max-w-md">
          <Search className="text-muted absolute start-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="ps-9"
          />
        </div>
      </header>

      <nav aria-label={t("categoriesLabel")} className="flex gap-2 overflow-x-auto pb-1">
        {[undefined, ...categories].map((c) => (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              category === c
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-text hover:bg-surface-2",
            )}
          >
            {c ? tc(c) : t("all")}
          </button>
        ))}
      </nav>

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState icon={Store} title={t("emptyTitle")} description={t("emptyHint")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <li key={l.key}>
              <Link href={`/marketplace/${l.key}`} className="group block h-full">
                <Card className="group-hover:border-accent/50 flex h-full flex-col gap-3 p-4 transition-colors group-focus-visible:outline">
                  <div className="flex items-start gap-3">
                    <AppMark name={l.name} kind={l.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{l.name}</p>
                      <p className="text-muted truncate text-xs">{l.publisher}</p>
                    </div>
                    {l.installed && (
                      <Badge tone="success">
                        <CheckCircle2 aria-hidden />
                        {l.kind === "partner" ? t("installed") : t("inUse")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted line-clamp-2 flex-1 text-sm">{text(l).summary}</p>
                  <div className="text-muted flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={l.kind === "partner" ? "warning" : "neutral"}>
                      {l.kind === "partner" ? t("partner") : t("builtInBadge")}
                    </Badge>
                    <span>{tc(l.category)}</span>
                    {l.rating != null && (
                      <span className="ms-auto flex items-center gap-1">
                        <Stars value={l.rating} />
                        <span className="tabular-nums">({l.reviews})</span>
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
