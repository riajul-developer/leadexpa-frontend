"use client";

import { ArrowLeft, CheckCircle2, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/input";
import { Checkbox, Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type ListingDetail, useDeleteReview, useInstall, useListing, useSaveReview, useUninstall } from "./api";
import { AppMark, StarInput, Stars, useListingText } from "./parts";

export function ListingPage({ listingKey }: { listingKey: string }) {
  const t = useTranslations("marketplace");
  const { data: l, isPending, isError } = useListing(listingKey);
  if (isPending) return <Skeleton className="m-4 h-96" />;
  if (isError || !l) return <EmptyState title={t("notFound")} />;
  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4">
      <Link href="/marketplace" className="text-muted hover:text-text flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("title")}
      </Link>
      <Hero l={l} />
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <About l={l} />
        <Facts l={l} />
      </div>
      <Reviews l={l} />
    </div>
  );
}

function Hero({ l }: { l: ListingDetail }) {
  const t = useTranslations("marketplace");
  const tc = useTranslations("marketplace.categories");
  const text = useListingText();
  const [consent, setConsent] = useState(false);
  const uninstall = useUninstall();
  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
      <CardContent className="flex flex-wrap items-start gap-4 pt-6">
        <AppMark name={l.name} kind={l.kind} className="size-16 text-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{l.name}</h1>
          <p className="text-muted text-sm">
            {t("by", { publisher: l.publisher })} · {tc(l.category)}
          </p>
          <p className="mt-1">{text(l).summary}</p>
          {l.rating != null && (
            <p className="text-muted mt-2 flex items-center gap-2 text-sm">
              <Stars value={l.rating} />
              <span className="tabular-nums">{t("ratingSummary", { rating: l.rating, n: l.reviews })}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2">
          {l.kind === "built_in" ? (
            <>
              {l.installed && (
                <Badge tone="success" className="self-end">
                  <CheckCircle2 aria-hidden />
                  {t("inUse")}
                </Badge>
              )}
              {l.setup_path && (
                <Button asChild>
                  <Link href={l.setup_path}>{l.installed ? t("manage") : t("setUp")}</Link>
                </Button>
              )}
            </>
          ) : l.installation ? (
            <>
              <Badge tone="success" className="self-end">
                <CheckCircle2 aria-hidden />
                {t("installed")}
              </Badge>
              <Button
                variant="secondary"
                className="text-danger"
                loading={uninstall.isPending}
                onClick={() =>
                  window.confirm(t("uninstallConfirm", { name: l.name })) &&
                  uninstall.mutate(l.installation!.id, { onSuccess: () => toast.success(t("uninstalled")) })
                }
              >
                {t("uninstall")}
              </Button>
            </>
          ) : (
            <Button onClick={() => setConsent(true)}>{t("install")}</Button>
          )}
        </div>
      </CardContent>
      {consent && <ConsentDialog l={l} onClose={() => setConsent(false)} />}
    </Card>
  );
}

function ConsentDialog({ l, onClose }: { l: ListingDetail; onClose: () => void }) {
  const t = useTranslations("marketplace.consent");
  const ts = useTranslations("developer.scopes");
  const te = useTranslations("errors");
  const install = useInstall(l.key);
  const [agreed, setAgreed] = useState(false);
  const done = install.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={done ? t("doneTitle", { name: l.name }) : t("title", { name: l.name })}>
        {done ? (
          <div className="grid gap-3">
            <p className="bg-warning-soft text-warning flex items-start gap-2 rounded-lg p-3 text-sm" role="status">
              <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("pasteOnce", { name: l.name })}
            </p>
            <code className="bg-surface-2 border-border rounded-lg border p-2 text-xs break-all" dir="ltr">
              {done.secret}
            </code>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(done.secret).then(() => toast.success(t("copied")))}
              >
                {t("copy")}
              </Button>
              <Button onClick={onClose}>{t("done")}</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm">{t("intro", { name: l.name, publisher: l.publisher })}</p>
            <ul className="grid gap-2">
              {l.scopes.map((s) => (
                <li key={s} className="border-border flex items-start gap-3 rounded-lg border p-3">
                  <ShieldCheck className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="grid gap-0.5">
                    <code className="text-sm font-medium" dir="ltr">
                      {s}
                    </code>
                    <span className="text-muted text-xs">{ts(s.replace(":", "_"))}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted text-xs">{t("revocable")}</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              {t("agree", { name: l.name })}
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                disabled={!agreed}
                loading={install.isPending}
                onClick={() =>
                  install.mutate(l.scopes, {
                    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
                  })
                }
              >
                {t("allow")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function About({ l }: { l: ListingDetail }) {
  const t = useTranslations("marketplace");
  const text = useListingText();
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>{t("about")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-line">{text(l).description || text(l).summary}</p>
      </CardContent>
    </Card>
  );
}

function Facts({ l }: { l: ListingDetail }) {
  const t = useTranslations("marketplace");
  const tc = useTranslations("marketplace.categories");
  const f = useFormat();
  return (
    <Card>
      <CardContent className="grid gap-3 pt-4 text-sm">
        <dl className="grid gap-2">
          <div>
            <dt className="text-muted text-xs">{t("publisher")}</dt>
            <dd>{l.publisher}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("category")}</dt>
            <dd>{tc(l.category)}</dd>
          </div>
          {l.installs != null && (
            <div>
              <dt className="text-muted text-xs">{t("agencies")}</dt>
              <dd className="tabular-nums">{f.number(l.installs)}</dd>
            </div>
          )}
          {l.kind === "partner" && (
            <div>
              <dt className="text-muted text-xs">{t("access")}</dt>
              <dd className="flex flex-wrap gap-1">
                {l.scopes.map((s) => (
                  <Badge key={s} tone="primary" dir="ltr">
                    {s}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {l.website && (
          <a
            href={l.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex items-center gap-1 underline-offset-2 hover:underline"
          >
            {t("website")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {l.support_email && (
          <a href={`mailto:${l.support_email}`} className="text-primary underline-offset-2 hover:underline" dir="ltr">
            {l.support_email}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function Reviews({ l }: { l: ListingDetail }) {
  const t = useTranslations("marketplace.reviews");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const mine = l.review_list.find((r) => r.mine);
  const save = useSaveReview(l.key);
  const remove = useDeleteReview(l.key);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? "");
  }, [mine?.rating, mine?.body]);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="bg-surface-2 grid gap-2 rounded-lg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ rating, body }, { onSuccess: () => toast.success(t("saved")) });
          }}
        >
          <p className="text-sm font-medium">{mine ? t("yours") : t("write")}</p>
          <StarInput value={rating} onChange={setRating} />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("placeholder")}
            aria-label={t("text")}
          />
          <div className="flex justify-end gap-2">
            {mine && (
              <Button type="button" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()}>
                {t("delete")}
              </Button>
            )}
            <Button type="submit" disabled={rating === 0} loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
        {l.review_list.length === 0 ? (
          <p className="text-muted py-4 text-center text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border grid divide-y">
            {l.review_list.map((r, i) => (
              <li key={i} className="grid gap-1 py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="text-muted text-xs">
                    {r.mine ? t("yourAgency") : t("anAgency", { country: r.country || "—" })} ·{" "}
                    {f.dateTime(r.at, tz, "date")}
                  </span>
                </p>
                {r.body && <p className="text-sm">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
