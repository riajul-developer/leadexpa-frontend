"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Mail, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LoginForm } from "@/features/auth";
import { ReviewDocument } from "@/features/revintel";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap, unwrapEmpty } from "@/shared/lib/api/client";
import { localDate } from "@/shared/lib/format";
import { meKey, useMe } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { BrandMarkOf, BrandTheme } from "./brand-theme";

/** /p/[slug]: the agency's branded sign-in for its clients (before anyone is signed in). */
export function PortalLogin({ slug }: { slug: string }) {
  const t = useTranslations("portal");
  const brand = useQuery({
    queryKey: ["public-brand", slug],
    queryFn: () => unwrap(api.GET("/v1/public/brand/{slug}", { params: { path: { slug } } })),
    retry: false,
  });
  if (brand.isPending) return <Skeleton className="m-auto mt-20 h-96 w-full max-w-sm" />;
  if (!brand.data)
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <div className="grid justify-items-center gap-3 text-center">
          <XCircle className="text-danger size-10" aria-hidden />
          <h1 className="font-medium">{t("unknown")}</h1>
        </div>
      </main>
    );
  const b = brand.data;
  return (
    <BrandTheme brand={b}>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="flex w-full max-w-sm justify-end">
          <LocaleSwitcher />
        </div>
        <BrandMarkOf brand={b} className="h-14 w-auto" />
        <div className="rounded-card border-border bg-surface shadow-pop relative w-full max-w-sm overflow-hidden border p-6 pt-7">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 [background:var(--brand-rule)]" />
          <h1 className="text-xl font-semibold">{t("signInTitle", { brand: b.display_name })}</h1>
          <p className="text-muted mt-1 text-sm">{t("signInHint")}</p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>
        {b.support_email && (
          <p className="text-muted text-sm">
            {t("help")}{" "}
            <a className="text-primary underline" href={`mailto:${b.support_email}`} dir="ltr">
              {b.support_email}
            </a>
          </p>
        )}
      </main>
    </BrandTheme>
  );
}

const day = (offset: number, tz: string) => localDate(new Date(Date.now() + offset * 864e5), tz);

/** /portal: what a client sees — their results and the reviews their agency approved, in the agency's brand. */
export function PortalHome() {
  const t = useTranslations("portal");
  const f = useFormat();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const brand = useQuery({ queryKey: ["brand"], queryFn: () => unwrap(api.GET("/v1/branding")), enabled: !!me.data });
  const clients = useQuery({
    queryKey: ["portal-clients"],
    queryFn: () => unwrap(api.GET("/v1/clients")),
    enabled: !!me.data,
  });
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const list = clients.data?.data ?? [];
  const client = list.find((c) => c.id === picked) ?? list[0];
  const tz = client?.timezone ?? "UTC";
  const from = day(-30, tz);
  const to = day(-1, tz);
  const dash = useQuery({
    queryKey: ["portal-dashboard", client?.id, from, to],
    queryFn: () => unwrap(api.GET("/v1/dashboard", { params: { query: { client_id: client!.id, from, to } } })),
    enabled: !!client,
  });
  const reviews = useQuery({
    queryKey: ["portal-reviews", client?.id],
    queryFn: () =>
      unwrap(api.GET("/v1/clients/{clientId}/business-reviews", { params: { path: { clientId: client!.id } } })),
    enabled: !!client,
  });
  const [openReview, setOpenReview] = useState<string | null>(null);

  useEffect(() => {
    if (me.isError) router.replace("/login?returnTo=/portal");
  }, [me.isError, router]);

  if (me.isPending || brand.isPending || clients.isPending) return <Skeleton className="m-4 h-96" />;
  const b = brand.data;
  const k = dash.data?.kpis;
  const prev = dash.data?.previous_kpis;
  const delta = (cur?: number, before?: number) =>
    cur == null || before == null || before === 0 ? undefined : (cur - before) / before;
  const revenue = k?.revenue?.[0];
  const signOut = async () => {
    await unwrapEmpty(api.POST("/v1/auth/logout")).catch(() => undefined);
    qc.removeQueries({ queryKey: meKey });
    router.replace(b ? `/p/${b.slug}` : "/login");
  };
  const rows = reviews.data?.data ?? [];
  const shown = rows.find((r) => r.id === openReview) ?? rows[0];
  return (
    <BrandTheme brand={b}>
      <header className="border-border bg-surface flex flex-wrap items-center gap-3 border-b px-4 py-3">
        {b && <BrandMarkOf brand={b} className="h-8 w-auto" />}
        {list.length > 1 ? (
          <NativeSelect
            className="w-auto"
            aria-label={t("client")}
            value={client?.id ?? ""}
            onChange={(e) => setPicked(e.target.value)}
          >
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <span className="text-muted text-sm">{client?.name}</span>
        )}
        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut aria-hidden />
            {t("signOut")}
          </Button>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-4 p-4 md:p-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{t("title", { client: client?.name ?? "" })}</h1>
          <p className="text-muted text-sm">
            {t("period", {
              from: f.dateTime(from + "T12:00:00Z", "UTC", "date"),
              to: f.dateTime(to + "T12:00:00Z", "UTC", "date"),
            })}
          </p>
        </div>
        {!client ? (
          <EmptyState title={t("noClient")} />
        ) : (
          <>
            <section
              aria-label={t("results")}
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
              data-testid="portal-kpis"
            >
              <Kpi
                label={t("kpi.leads")}
                value={k ? f.number(k.leads_received) : undefined}
                change={delta(k?.leads_received, prev?.leads_received)}
              />
              <Kpi
                label={t("kpi.contacted")}
                value={k?.contact_rate != null ? f.percent(k.contact_rate) : k ? "—" : undefined}
              />
              <Kpi
                label={t("kpi.won")}
                value={k ? f.number(k.leads_won) : undefined}
                change={delta(k?.leads_won, prev?.leads_won)}
              />
              <Kpi
                label={t("kpi.revenue")}
                value={
                  k
                    ? revenue
                      ? f.money({ amount_minor: revenue.amount_minor, currency: revenue.currency })
                      : "—"
                    : undefined
                }
              />
            </section>
            <Card>
              <CardHeader>
                <CardTitle>{t("reviews")}</CardTitle>
                {rows.length > 1 && (
                  <NativeSelect
                    className="w-auto"
                    aria-label={t("pickReview")}
                    value={shown?.id ?? ""}
                    onChange={(e) => setOpenReview(e.target.value)}
                  >
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {f.dateTime(r.period_from + "T12:00:00Z", "UTC", "date")} –{" "}
                        {f.dateTime(r.period_to + "T12:00:00Z", "UTC", "date")}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </CardHeader>
              <CardContent>
                {reviews.isPending ? (
                  <Skeleton className="h-40 w-full" />
                ) : !shown ? (
                  <p className="text-muted text-sm">{t("noReviews")}</p>
                ) : (
                  <ReviewDocument review={shown} />
                )}
              </CardContent>
            </Card>
            {b?.support_email && (
              <p className="text-muted flex items-center gap-2 text-sm">
                <Mail className="size-4" aria-hidden />
                {t("questions", { brand: b.display_name })}{" "}
                <a className="text-primary underline" href={`mailto:${b.support_email}`} dir="ltr">
                  {b.support_email}
                </a>
              </p>
            )}
          </>
        )}
      </main>
    </BrandTheme>
  );
}

function Kpi({ label, value, change }: { label: string; value?: string; change?: number }) {
  const f = useFormat();
  const t = useTranslations("portal");
  return (
    <Card>
      <CardContent className="grid gap-0.5 pt-4">
        <span className="text-muted text-xs">{label}</span>
        {value == null ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        )}
        {change != null && (
          <span className={change >= 0 ? "text-success text-xs" : "text-danger text-xs"}>
            {t("vsBefore", { change: (change >= 0 ? "+" : "") + f.percent(change, 0) })}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
