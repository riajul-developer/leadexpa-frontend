"use client";

import { CheckCircle2, Clock, LinkIcon, MessageCircle, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { components } from "@/shared/lib/api/schema";
import { formatRelative, telHref, whatsappHref, type AppLocale } from "@/shared/lib/format";

type View = components["schemas"]["ActionLinkView"];
type Channel = "call" | "whatsapp";
type Outcome = "connected" | "no_answer" | "busy" | "wrong_number" | "interested" | "not_interested" | "message_sent";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const OUTCOMES: Record<Channel, Outcome[]> = {
  call: ["connected", "interested", "not_interested", "no_answer", "busy", "wrong_number"],
  whatsapp: ["message_sent", "interested", "not_interested", "wrong_number"],
};

type State =
  | { kind: "loading" }
  | { kind: "error"; code: "action_link_invalid" | "action_link_expired" | "network" }
  | { kind: "ready"; view: View };

async function call(path: string, init?: RequestInit): Promise<View> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "omit",
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as (View & { code?: string }) | null;
  if (!res.ok) throw new Error(body?.code === "action_link_expired" ? "action_link_expired" : "action_link_invalid");
  return body as View;
}

export function ActionLinkPage({ token }: { token: string }) {
  const t = useTranslations("actionLink");
  const locale = useLocale() as AppLocale;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [channel, setChannel] = useState<Channel | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const path = `/v1/public/action-links/${encodeURIComponent(token)}`;

  const fail = (e: unknown) =>
    setState({
      kind: "error",
      code:
        e instanceof TypeError
          ? "network"
          : (e as Error).message === "action_link_expired"
            ? "action_link_expired"
            : "action_link_invalid",
    });

  const load = useCallback(() => {
    call(path)
      .then((view) => setState({ kind: "ready", view }))
      .catch(fail);
  }, [path]);
  useEffect(load, [load]);

  const log = async (outcome: Outcome) => {
    if (!channel) return;
    setSaving(true);
    try {
      const view = await call(path + "/activities", {
        method: "POST",
        body: JSON.stringify({ type: channel, outcome }),
      });
      setState({ kind: "ready", view });
      setChannel(null);
      setSaved(true);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  if (state.kind === "loading") {
    return <main className="text-muted flex min-h-dvh items-center justify-center p-6 text-sm">{t("loading")}</main>;
  }
  if (state.kind === "error") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <LinkIcon className="text-muted size-12" aria-hidden />
        <h1 className="text-xl font-semibold">
          {t(state.code === "action_link_expired" ? "expired" : state.code === "network" ? "offline" : "invalid")}
        </h1>
        <p className="text-muted max-w-sm text-sm">{t(state.code === "network" ? "offlineHint" : "invalidHint")}</p>
        {state.code === "network" && (
          <button
            type="button"
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium"
            onClick={load}
          >
            {t("retry")}
          </button>
        )}
      </main>
    );
  }

  const v = state.view;
  const answers = Object.entries((v.answers ?? {}) as Record<string, unknown>).filter(([, a]) => a != null && a !== "");
  const fmt = { locale, digits: "latn" as const, region: null, hourCycle: null };
  const btn = "flex h-12 items-center justify-center gap-2 rounded-lg text-base font-medium";

  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-6">
      <p className="text-muted text-sm">{v.client_name}</p>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold break-words">{v.full_name || v.phone?.display || "—"}</h1>
        {v.phone && (
          <p className="text-muted text-sm" dir="ltr">
            {v.phone.display}
          </p>
        )}
        <p className="text-muted flex items-center gap-1 text-xs">
          <Clock className="size-3.5" aria-hidden />
          {t("received", { when: formatRelative(v.received_at, Date.now(), fmt) })}
          {v.sla?.status === "overdue" && <span className="text-danger ms-2 font-medium">{t("overdue")}</span>}
        </p>
      </header>

      {saved && (
        <p role="status" className="bg-success/10 text-success flex items-center gap-2 rounded-lg p-3 text-sm">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("saved")}
        </p>
      )}

      {v.do_not_contact ? (
        <p className="bg-danger/10 text-danger rounded-lg p-3 text-sm">{t("doNotContact")}</p>
      ) : (
        v.phone && (
          <div className="grid grid-cols-2 gap-2">
            <a
              className={`${btn} bg-primary text-primary-foreground`}
              href={telHref(v.phone.e164)}
              onClick={() => setChannel("call")}
            >
              <Phone className="size-5" aria-hidden />
              {t("call")}
            </a>
            <a
              className={`${btn} border-border border`}
              href={whatsappHref(v.phone.e164)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setChannel("whatsapp")}
            >
              <MessageCircle className="size-5" aria-hidden />
              {t("whatsapp")}
            </a>
          </div>
        )
      )}

      {!v.do_not_contact && v.phone && (
        <section className="grid gap-2" aria-labelledby="al-outcome">
          <h2 id="al-outcome" className="text-sm font-semibold">
            {t("whatHappened")}
          </h2>
          {!channel ? (
            <div className="flex gap-2">
              {(["call", "whatsapp"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  className="border-border rounded-lg border px-3 py-2 text-sm"
                  onClick={() => setChannel(c)}
                >
                  {t(c === "call" ? "loggedCall" : "loggedWhatsApp")}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES[channel].map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={saving}
                  className="border-border min-h-12 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                  onClick={() => void log(o)}
                >
                  {t(`outcome.${o}`)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {answers.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold">{t("answers")}</h2>
          <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
            {answers.map(([k, a]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-words">{typeof a === "string" ? a : JSON.stringify(a)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <p className="text-muted text-xs">{t("linkNote")}</p>
    </main>
  );
}
