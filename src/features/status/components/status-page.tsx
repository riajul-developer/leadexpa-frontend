"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  type HealthState,
  type PublicStatus,
  type StatusComponent,
  type StatusIncident,
  fetchPublicStatus,
  localized,
} from "../api";

const REFRESH_MS = 60_000;

const DOT: Record<HealthState, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-danger",
  no_data: "bg-border",
};

const TONE: Record<HealthState, string> = {
  operational: "bg-success-soft text-success",
  degraded: "bg-warning-soft text-warning",
  down: "bg-danger-soft text-danger",
  no_data: "bg-surface-2 text-muted",
};

function useDateTime() {
  const locale = useLocale();
  return (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
      new Date(iso),
    ) + " UTC";
}

export function StatusPage() {
  const t = useTranslations("serviceStatus");
  const [data, setData] = useState<PublicStatus | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    const load = () =>
      fetchPublicStatus(ctl.signal)
        .then((d) => {
          setData(d);
          setFailed(false);
        })
        .catch(() => !ctl.signal.aborted && setFailed(true));
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      ctl.abort();
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-dvh">
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted text-sm">{t("subtitle")}</p>
        </header>
        {!data ? (
          failed ? (
            <p role="alert" className="bg-surface-2 rounded-lg px-4 py-3 text-sm">
              {t("unavailable")}
            </p>
          ) : (
            <p className="text-muted text-sm">{t("loading")}</p>
          )
        ) : (
          <StatusBody data={data} />
        )}
      </div>
    </main>
  );
}

function StatusBody({ data }: { data: PublicStatus }) {
  const t = useTranslations("serviceStatus");
  const at = useDateTime();
  return (
    <>
      <p role="status" data-testid="status-overall" className={`rounded-lg px-4 py-3 font-medium ${TONE[data.state]}`}>
        {t(`overall.${data.state}`)}
      </p>
      {data.active.length > 0 && (
        <section className="grid gap-3" aria-labelledby="active-h">
          <h2 id="active-h" className="text-lg font-semibold">
            {t("active")}
          </h2>
          {data.active.map((i) => (
            <IncidentCard key={i.id} incident={i} />
          ))}
        </section>
      )}
      {data.upcoming.length > 0 && (
        <section className="grid gap-3" aria-labelledby="upcoming-h">
          <h2 id="upcoming-h" className="text-lg font-semibold">
            {t("upcoming")}
          </h2>
          {data.upcoming.map((i) => (
            <IncidentCard key={i.id} incident={i} />
          ))}
        </section>
      )}
      <section className="grid gap-4" aria-labelledby="regions-h">
        <h2 id="regions-h" className="text-lg font-semibold">
          {t("regions")}
        </h2>
        {data.regions.length === 0 && <p className="text-muted text-sm">{t("noRegions")}</p>}
        {data.regions.map((r) => (
          <article
            key={r.region}
            className="border-border bg-surface grid gap-3 rounded-xl border p-4"
            data-testid="status-region"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold" dir="ltr">
                {r.region}
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[r.state]}`}>
                {r.maintenance ? t("maintenance") : t(`state.${r.state}`)}
              </span>
              <span className="text-muted ms-auto text-xs">{t("uptime90", { value: r.uptime_90d })}</span>
            </div>
            <ul className="grid gap-3">
              {r.components.map((c) => (
                <ComponentRow key={c.key} component={c} />
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section className="grid gap-3" aria-labelledby="history-h">
        <h2 id="history-h" className="text-lg font-semibold">
          {t("history")}
        </h2>
        {data.history.length === 0 ? (
          <p className="text-muted text-sm">{t("noHistory")}</p>
        ) : (
          data.history.map((i) => <IncidentCard key={i.id} incident={i} />)
        )}
      </section>
      <p className="text-muted text-xs">
        {t("targets", { standard: data.sla_targets.standard, enterprise: data.sla_targets.enterprise })} ·{" "}
        {t("updated", { when: at(data.generated_at) })}
      </p>
    </>
  );
}

function ComponentRow({ component: c }: { component: StatusComponent }) {
  const t = useTranslations("serviceStatus");
  return (
    <li className="grid gap-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className={`size-2.5 shrink-0 rounded-full ${DOT[c.state]}`} aria-hidden />
        <span className="font-medium">{t(`components.${c.key}`)}</span>
        <span className="text-muted text-xs">{t(`state.${c.state}`)}</span>
        <span className="text-muted ms-auto text-xs">{t("uptime90", { value: c.uptime_90d })}</span>
      </div>
      {/* Stays left-to-right in every locale, like a timeline. */}
      <div className="flex h-6 gap-px" dir="ltr" role="img" aria-label={t("bars", { name: t(`components.${c.key}`) })}>
        {c.days.map((d) => (
          <span
            key={d.date}
            className={`min-w-0 flex-1 rounded-sm ${DOT[d.state]}`}
            title={d.uptime === null ? `${d.date}: ${t("state.no_data")}` : `${d.date}: ${d.uptime}%`}
          />
        ))}
      </div>
    </li>
  );
}

function IncidentCard({ incident: i }: { incident: StatusIncident }) {
  const t = useTranslations("serviceStatus");
  const locale = useLocale();
  const at = useDateTime();
  return (
    <article className="border-border bg-surface grid gap-2 rounded-xl border p-4" data-testid="status-incident">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{localized(i.title, locale)}</h3>
        <span className="bg-surface-2 text-muted rounded-full px-2 py-0.5 text-xs">
          {t(`incidentStatus.${i.status}`)}
        </span>
        {i.automatic && (
          <span
            className="bg-surface-2 text-muted rounded-full px-2 py-0.5 text-xs"
            data-testid="status-incident-automatic"
          >
            {t("automatic")}
          </span>
        )}
      </div>
      <p className="text-muted text-xs">
        {i.kind === "maintenance" && i.scheduled_for && i.scheduled_until
          ? t("window", { start: at(i.scheduled_for), end: at(i.scheduled_until) })
          : t("affects", {
              regions: i.regions.length ? i.regions.join(", ") : t("allRegions"),
              components: i.components.length
                ? i.components.map((c) => t(`components.${c}`)).join(", ")
                : t("allComponents"),
            })}
      </p>
      <ol className="grid gap-2">
        {i.updates.map((u, n) => (
          <li key={n} className="text-sm">
            <span className="font-medium">{t(`incidentStatus.${u.status}`)}</span>{" "}
            <span className="text-muted text-xs">{at(u.created_at)}</span>
            <p>{localized(u.body, locale)}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
