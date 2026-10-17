"use client";

import { CalendarCheck, CalendarPlus, Clock, Percent, UserCheck, Users, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { localDate } from "@/shared/lib/format";
import { useClients, useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Switch } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type Appointment, useAppointments, useFunnel, useOutcome } from "./api";
import { AppointmentStatusBadge, RiskBadge } from "./parts";

const PERIODS = [7, 30, 90] as const;

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** /appointments: what's coming up, what needs an outcome, and the booked → attended funnel (10.1). */
export function AppointmentsPage() {
  const t = useTranslations("appointments.page");
  const active = useActiveClient();
  const { clients } = useClients();
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const scope = clientId ?? active ?? undefined;
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarCheck className="text-accent size-6" aria-hidden />
            {t("title")}
          </h1>
          <p className="text-muted text-sm">{t("subtitle")}</p>
        </div>
        <NativeSelect
          className="w-auto"
          aria-label={t("client")}
          value={scope ?? ""}
          onChange={(e) => setClientId(e.target.value || undefined)}
        >
          <option value="">{t("allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </header>
      <FunnelSection clientId={scope} />
      <UpcomingSection clientId={scope} />
    </div>
  );
}

function FunnelSection({ clientId }: { clientId?: string }) {
  const t = useTranslations("appointments.funnel");
  const f = useFormat();
  const canReport = useCan("report.read");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const q = useFunnel({ from: day(-period), to: day(0), client_id: clientId });
  if (!canReport) return null;
  const total = q.data?.total;
  return (
    <section aria-labelledby="funnel-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="funnel-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <NativeSelect
          className="w-auto"
          aria-label={t("period")}
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value) as (typeof PERIODS)[number])}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t("lastDays", { days: p })}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard loading={!total} label={t("leads")} value={f.number(total?.leads ?? 0)} icon={Users} />
        <KpiCard
          loading={!total}
          label={t("booked")}
          value={f.number(total?.booked ?? 0)}
          icon={CalendarPlus}
          tone="info"
          secondary={total?.book_rate != null ? t("ofLeads", { rate: f.percent(total.book_rate) }) : undefined}
        />
        <KpiCard
          loading={!total}
          label={t("attended")}
          value={f.number(total?.attended ?? 0)}
          icon={UserCheck}
          tone="success"
        />
        <KpiCard
          loading={!total}
          label={t("noShow")}
          value={f.number(total?.no_show ?? 0)}
          icon={UserX}
          tone="danger"
        />
        <KpiCard
          loading={!total}
          label={t("showRate")}
          value={total?.show_rate != null ? f.percent(total.show_rate) : "—"}
          definition={t("showRateDef")}
          icon={Percent}
          tone="warning"
        />
      </div>
      {q.data && q.data.rows.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("byCampaign")}</caption>
              <thead className="text-muted text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="p-3 text-start font-medium">
                    {t("campaign")}
                  </th>
                  {(["leads", "booked", "attended", "noShow", "won", "showRate"] as const).map((k) => (
                    <th key={k} scope="col" className="p-3 text-end font-medium">
                      {t(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((r) => (
                  <tr key={r.campaign_id ?? "none"} className="border-border border-b last:border-0">
                    <th scope="row" className="p-3 text-start font-medium">
                      {r.campaign || t("noCampaign")}
                    </th>
                    <td className="p-3 text-end tabular-nums">{f.number(r.leads)}</td>
                    <td className="p-3 text-end tabular-nums">{f.number(r.booked)}</td>
                    <td className="p-3 text-end tabular-nums">{f.number(r.attended)}</td>
                    <td className="p-3 text-end tabular-nums">{f.number(r.no_show)}</td>
                    <td className="p-3 text-end tabular-nums">{f.number(r.won)}</td>
                    <td className="p-3 text-end tabular-nums">{r.show_rate != null ? f.percent(r.show_rate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function UpcomingSection({ clientId }: { clientId?: string }) {
  const t = useTranslations("appointments.page");
  const te = useTranslations("errors");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const canUpdate = useCan("lead.update");
  const [mine, setMine] = useState(false);
  const q = useAppointments({ from: day(-7), to: day(31), client_id: clientId, mine: mine || undefined });
  const outcome = useOutcome();
  const now = Date.now();
  const rows = q.data?.data ?? [];
  const needOutcome = rows.filter(
    (a) => (a.status === "booked" || a.status === "confirmed") && Date.parse(a.starts_at) <= now,
  );
  const upcoming = rows.filter((a) => Date.parse(a.starts_at) > now && a.status !== "cancelled");
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of upcoming) {
      const d = localDate(new Date(a.starts_at), tz);
      m.set(d, [...(m.get(d) ?? []), a]);
    }
    return [...m.entries()];
  }, [upcoming, tz]);
  const fail = (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed"));
  return (
    <>
      {needOutcome.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("needOutcome", { count: needOutcome.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {needOutcome.map((a) => (
                <li
                  key={a.id}
                  className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <Row a={a} tz={tz} />
                  {canUpdate && (
                    <div
                      className="ms-auto flex gap-2"
                      role="group"
                      aria-label={t("outcomeFor", { name: a.lead_name ?? "" })}
                    >
                      {(["attended", "no_show"] as const).map((o) => (
                        <Button
                          key={o}
                          size="sm"
                          variant={o === "attended" ? "primary" : "secondary"}
                          loading={
                            outcome.isPending && outcome.variables?.id === a.id && outcome.variables.outcome === o
                          }
                          onClick={() => outcome.mutate({ id: a.id, outcome: o }, { onError: fail })}
                        >
                          {t(`outcome.${o}`)}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("upcoming")}</CardTitle>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={mine} onCheckedChange={setMine} aria-label={t("mine")} />
            {t("mine")}
          </label>
        </CardHeader>
        <CardContent>
          {q.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : byDay.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={t("empty")} description={t("emptyHint")} />
          ) : (
            <div className="grid gap-4">
              {byDay.map(([d, list]) => (
                <section key={d} aria-label={f.dateTime(list[0]!.starts_at, tz, "date")} className="grid gap-2">
                  <h3 className="text-muted text-xs font-semibold uppercase">
                    {f.dateTime(list[0]!.starts_at, tz, "date")}
                  </h3>
                  <ul className="grid gap-2">
                    {list.map((a) => (
                      <li
                        key={a.id}
                        className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
                      >
                        <Row a={a} tz={tz} timeOnly />
                        <Details a={a} now={now} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ a, tz, timeOnly }: { a: Appointment; tz: string; timeOnly?: boolean }) {
  const f = useFormat();
  return (
    <>
      <span className="font-semibold tabular-nums">{f.dateTime(a.starts_at, tz, timeOnly ? "time" : "short")}</span>
      <Link href={`/leads/${a.lead_id}`} className="text-primary font-medium hover:underline">
        {a.lead_name || a.title}
      </Link>
      <span className="text-muted">{a.client_name}</span>
      <AppointmentStatusBadge status={a.status} />
      <RiskBadge appt={a} />
    </>
  );
}

/** Right side of an upcoming row: how soon, how long and with whom. */
function Details({ a, now }: { a: Appointment; now: number }) {
  const t = useTranslations("appointments.page");
  const f = useFormat();
  const { byUserId } = useMembers();
  const host = byUserId.get(a.host_user_id)?.user.name;
  const soon = Date.parse(a.starts_at) - now < 2 * 3600_000;
  return (
    <div className="text-muted ms-auto flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1" title={t("duration")}>
        <Clock className="size-3.5" aria-hidden />
        {f.duration((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 1000)}
      </span>
      {host && <span>{t("host", { name: host })}</span>}
      <span className={cn("font-medium tabular-nums", soon ? "text-warning" : "text-text")}>
        {f.relative(a.starts_at, now)}
      </span>
    </div>
  );
}
