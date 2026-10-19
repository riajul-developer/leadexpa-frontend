"use client";

import { LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ago, lite, LiteError, localePath, type Schemas } from "./api";
import { LeadActions } from "./lead-actions";
import { NavLink } from "./nav-link";

type Item = Schemas["InboxPage"]["data"][number];

const SECTIONS = ["overdue", "due_soon", "callback_due", "new", "in_progress"] as const;

type State = { kind: "loading" } | { kind: "offline" } | { kind: "ready"; items: Item[] };

export function LiteLeads() {
  const t = useTranslations("lite");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    lite<Schemas["InboxPage"]>("GET", "/v1/inbox?limit=50")
      .then((page) => setState({ kind: "ready", items: page.data }))
      .catch((e: unknown) => {
        if (e instanceof LiteError && (e.status === 401 || e.status === 403))
          router.replace(localePath(locale, "/lite/login"));
        else setState({ kind: "offline" });
      });
  }, [locale, router]);
  useEffect(load, [load]);

  const signOut = async () => {
    await lite("POST", "/v1/auth/logout").catch(() => undefined);
    router.replace(localePath(locale, "/lite/login"));
  };

  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-semibold">{t("myLeads")}</h1>
        <button
          type="button"
          className="text-muted flex size-12 items-center justify-center"
          onClick={load}
          aria-label={t("refresh")}
        >
          <RefreshCw className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          className="text-muted flex size-12 items-center justify-center"
          onClick={() => void signOut()}
          aria-label={t("signOut")}
        >
          <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </header>
      {state.kind === "loading" && <p className="text-muted py-12 text-center text-sm">{t("loading")}</p>}
      {state.kind === "offline" && (
        <div className="grid justify-items-center gap-3 py-12 text-center">
          <p className="text-muted text-sm">{t("offline")}</p>
          <button
            type="button"
            className="border-border min-h-12 rounded-lg border px-4 text-sm font-medium"
            onClick={load}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {state.kind === "ready" && state.items.length === 0 && (
        <p className="text-muted py-12 text-center text-sm">{t("empty")}</p>
      )}
      {state.kind === "ready" &&
        SECTIONS.map((section) => {
          const items = state.items.filter((i) => i.section === section);
          if (items.length === 0) return null;
          return (
            <section key={section} className="grid gap-3" aria-labelledby={`lite-${section}`}>
              <h2
                id={`lite-${section}`}
                className={`text-sm font-semibold ${section === "overdue" ? "text-danger" : "text-muted"}`}
              >
                {t(`section.${section}`)} · {items.length}
              </h2>
              {items.map((l) => (
                <article
                  key={l.id}
                  className={`border-border bg-surface grid gap-3 rounded-xl border p-4 ${section === "overdue" ? "border-danger" : ""}`}
                >
                  <NavLink href={localePath(locale, `/lite/leads/${l.id}`)} className="grid gap-1">
                    <span className="text-lg font-semibold break-words">{l.full_name || l.phone?.display || "—"}</span>
                    {l.phone && (
                      <span className="text-muted text-sm" dir="ltr">
                        {l.phone.display}
                      </span>
                    )}
                    <span className="text-muted flex items-center gap-1 text-xs">
                      {t("received", { when: ago(l.received_at, locale) })}
                    </span>
                  </NavLink>
                  <LeadActions lead={l} onLogged={load} />
                </article>
              ))}
            </section>
          );
        })}
    </main>
  );
}
