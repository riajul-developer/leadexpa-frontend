"use client";

import { Clock, Maximize, MonitorOff, Timer, TriangleAlert, Trophy, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import type { components } from "@/shared/lib/api/schema";
import { type AppLocale, formatNumber, formatPercent } from "@/shared/lib/format";

type Board = components["schemas"]["WallboardBoard"];
type Stats = components["schemas"]["WallboardStats"];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const STORE = "leadexpa-tv-token";

type State =
  { kind: "loading" } | { kind: "unpaired" } | { kind: "inactive" } | { kind: "ready"; board: Board; stale: boolean };

function readToken(): string | null {
  // The pairing link carries the token in the fragment (#k=…): keep it, then take it out of the address bar.
  const m = /[#&]k=([\w-]+)/.exec(window.location.hash);
  try {
    if (m) {
      localStorage.setItem(STORE, m[1]!);
      history.replaceState(null, "", window.location.pathname);
      return m[1]!;
    }
    return localStorage.getItem(STORE);
  } catch {
    return m?.[1] ?? null; // private mode: works until the tab closes
  }
}

/** mm:ss under an hour, then h:mm — readable from across a room. */
function clockDuration(seconds: number | null | undefined, fmt: (n: number) => string): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  const pad = (n: number) => fmt(n).padStart(2, fmt(0));
  if (s < 3600) return `${fmt(Math.floor(s / 60))}:${pad(s % 60)}`;
  return `${fmt(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

/**
 * /tv: the sales-floor wallboard (Tier 3, 8h). Paired by a kiosk token, no login. Big numbers, clients rotating,
 * an opt-in leaderboard, dimmed at night. Plain fetch, no app shell: TVs and sticks are slow.
 */
export function TvPage() {
  const t = useTranslations("wallboard.tv");
  const locale = useLocale() as AppLocale;
  const fmtO = { locale, digits: "latn" as const, region: null, hourCycle: null };
  const num = (n: number) => formatNumber(n, fmtO);
  const pct = (r: number | null | undefined) => formatPercent(r ?? null, fmtO);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const token = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!token.current) return setState({ kind: "unpaired" });
    try {
      const res = await fetch(`${API}/v1/public/wallboard`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current }),
        credentials: "omit",
        cache: "no-store",
      });
      if (res.status === 404) return setState({ kind: "unpaired" });
      if (res.status === 409) return setState({ kind: "inactive" });
      if (!res.ok) throw new Error(String(res.status));
      setState({ kind: "ready", board: (await res.json()) as Board, stale: false });
    } catch {
      setState((s) => (s.kind === "ready" ? { ...s, stale: true } : s)); // keep the last numbers on a blip
    }
  }, []);

  useEffect(() => {
    token.current = readToken();
    void load();
  }, [load]);

  const refresh = state.kind === "ready" ? state.board.refresh_seconds : 15;
  useEffect(() => {
    const id = setInterval(() => void load(), refresh * 1000);
    return () => clearInterval(id);
  }, [load, refresh]);

  const board = state.kind === "ready" ? state.board : null;
  const count = board?.clients.length ?? 0;
  const rotate = board?.rotate_seconds ?? 20;
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), rotate * 1000);
    return () => clearInterval(id);
  }, [count, rotate]);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Keep the screen awake (where the browser allows it).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } };
    const take = () =>
      void nav.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => undefined);
    take();
    const onVis = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  if (state.kind === "loading") return <main className="min-h-dvh bg-[#1b0d0b]" aria-busy />;
  if (state.kind === "unpaired" || state.kind === "inactive")
    return (
      <main className="grid min-h-dvh place-items-center bg-[#1b0d0b] p-8 text-center text-white">
        <div className="grid max-w-xl justify-items-center gap-4">
          <MonitorOff aria-hidden className="size-16 text-[#ebc07a]" />
          <h1 className="text-3xl font-semibold">{state.kind === "unpaired" ? t("unpaired") : t("inactive")}</h1>
          <p className="text-lg text-white/75">{t("unpairedHint")}</p>
        </div>
      </main>
    );

  const b = state.board;
  const client = b.clients[index % Math.max(1, b.clients.length)];
  const time = new Intl.DateTimeFormat(`${locale === "en-XA" ? "en" : locale}-u-nu-latn`, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: b.timezone,
  }).format(now);

  return (
    <main
      className={`relative flex min-h-dvh flex-col gap-6 bg-[#1b0d0b] p-6 text-white transition-[filter] duration-1000 lg:p-10 ${b.dimmed ? "brightness-[0.35]" : ""}`}
      data-dimmed={b.dimmed || undefined}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg text-[#ebc07a]">{b.brand?.display_name ?? b.agency}</p>
          <h1 className="truncate text-3xl font-semibold lg:text-4xl">{b.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          {state.stale && (
            <span role="status" className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
              {t("reconnecting")}
            </span>
          )}
          <span className="flex items-center gap-2 text-3xl tabular-nums" aria-label={t("time")}>
            <Clock aria-hidden className="size-7 text-white/60" />
            {time}
          </span>
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={t("fullscreen")}
          >
            <Maximize aria-hidden className="size-6" />
          </button>
        </div>
      </header>

      <section aria-label={t("today")} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          icon={TriangleAlert}
          label={t("overdue")}
          value={num(b.totals.overdue)}
          alert={b.totals.overdue > 0}
          testId="tv-overdue"
        />
        <Tile icon={Timer} label={t("speed")} value={clockDuration(b.totals.median_seconds, num)} testId="tv-speed" />
        <Tile icon={Clock} label={t("onTime")} value={pct(b.totals.on_time_rate)} />
        <Tile
          icon={Users}
          label={t("newToday")}
          value={num(b.totals.started)}
          sub={t("answered", { count: b.totals.answered })}
        />
      </section>

      <div className="grid flex-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {client ? (
          <section
            aria-label={t("clientPanel")}
            aria-live="polite"
            className="grid content-start gap-5 rounded-2xl bg-white/5 p-6"
            data-testid="tv-client"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-3xl font-semibold">{client.name}</h2>
              {b.clients.length > 1 && (
                <span
                  className="flex gap-1.5"
                  aria-label={t("position", { n: (index % b.clients.length) + 1, total: b.clients.length })}
                >
                  {b.clients.map((c, i) => (
                    <span
                      key={c.name + i}
                      className={`size-2.5 rounded-full ${i === index % b.clients.length ? "bg-[#ebc07a]" : "bg-white/25"}`}
                    />
                  ))}
                </span>
              )}
            </div>
            <ClientRow stats={client} t={t} num={num} pct={pct} />
          </section>
        ) : (
          <section className="grid place-items-center rounded-2xl bg-white/5 p-6 text-xl text-white/70">
            {t("noClients")}
          </section>
        )}
        {b.leaderboard && b.leaderboard.length > 0 && (
          <section aria-labelledby="tv-lb" className="grid content-start gap-3 rounded-2xl bg-white/5 p-6">
            <h2 id="tv-lb" className="flex items-center gap-2 text-2xl font-semibold">
              <Trophy aria-hidden className="size-6 text-[#ebc07a]" />
              {t("leaderboard")}
            </h2>
            <ol className="grid gap-2">
              {b.leaderboard.map((e, i) => (
                <li key={e.name + i} className="flex items-center gap-3 text-xl">
                  <span className="w-7 text-white/50 tabular-nums">{num(i + 1)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="text-white/70 tabular-nums">{clockDuration(e.median_seconds, num)}</span>
                  <span className="w-16 text-end tabular-nums">{num(e.answered)}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-white/50">{t("leaderboardHint")}</p>
          </section>
        )}
      </div>
    </main>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  alert,
  testId,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  testId?: string;
}) {
  return (
    <div className={`grid gap-1 rounded-2xl p-5 ${alert ? "bg-[#c22d1f]" : "bg-white/5"}`}>
      <span className="flex items-center gap-2 text-lg text-white/75">
        <Icon aria-hidden className="size-5" />
        {label}
      </span>
      <span className="text-5xl font-semibold tabular-nums lg:text-6xl" data-testid={testId}>
        {value}
      </span>
      {sub && <span className="text-base text-white/65">{sub}</span>}
    </div>
  );
}

function ClientRow({
  stats,
  t,
  num,
  pct,
}: {
  stats: Stats;
  t: ReturnType<typeof useTranslations>;
  num: (n: number) => string;
  pct: (r: number | null | undefined) => string;
}) {
  const cell = (label: string, value: string, alert = false) => (
    <div className="grid gap-1">
      <span className="text-base text-white/65">{label}</span>
      <span className={`text-4xl font-semibold tabular-nums ${alert ? "text-[#ff8a7a]" : ""}`}>{value}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      {cell(t("overdue"), num(stats.overdue), stats.overdue > 0)}
      {cell(t("speed"), clockDuration(stats.median_seconds, num))}
      {cell(t("onTime"), pct(stats.on_time_rate))}
      {cell(t("newToday"), num(stats.started))}
    </div>
  );
}
