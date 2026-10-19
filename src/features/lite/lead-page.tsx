"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ago, lite, LiteError, localePath, type Schemas } from "./api";
import { LeadActions } from "./lead-actions";
import { NavLink } from "./nav-link";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; lead: Schemas["LeadDetail"] };

export function LiteLead({ leadId }: { leadId: string }) {
  const t = useTranslations("lite");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    lite<Schemas["LeadDetail"]>("GET", `/v1/leads/${encodeURIComponent(leadId)}`)
      .then((lead) => setState({ kind: "ready", lead }))
      .catch((e: unknown) => {
        if (e instanceof LiteError && e.status === 401) router.replace(localePath(locale, "/lite/login"));
        else setState({ kind: "missing" });
      });
  }, [leadId, locale, router]);
  useEffect(load, [load]);

  const back = (
    <NavLink
      href={localePath(locale, "/lite")}
      className="text-primary flex min-h-12 items-center gap-1 text-sm font-medium"
    >
      {t("back")}
    </NavLink>
  );
  if (state.kind === "loading") return <p className="text-muted py-12 text-center text-sm">{t("loading")}</p>;
  if (state.kind === "missing") {
    return (
      <main className="mx-auto grid max-w-md gap-4 px-4 py-4">
        {back}
        <p className="text-muted text-sm">{t("notFound")}</p>
      </main>
    );
  }
  const l = state.lead;
  const answers = Object.entries((l.submissions[0]?.payload ?? {}) as Record<string, unknown>).filter(
    ([k, v]) => v != null && v !== "" && !k.startsWith("_"),
  );
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-4">
      {back}
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold break-words">{l.full_name || l.phone?.display || "—"}</h1>
        {l.phone && (
          <p className="text-muted text-sm" dir="ltr">
            {l.phone.display}
          </p>
        )}
        <p className="text-muted text-xs">{t("received", { when: ago(l.received_at, locale) })}</p>
      </header>
      <LeadActions lead={l} onLogged={load} />
      {answers.length > 0 && (
        <section className="grid gap-2" aria-labelledby="lite-answers">
          <h2 id="lite-answers" className="text-sm font-semibold">
            {t("answers")}
          </h2>
          <dl className="border-border grid gap-2 rounded-xl border p-4 text-sm">
            {answers.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted text-xs">{k}</dt>
                <dd className="break-words">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
