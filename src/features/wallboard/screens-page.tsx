"use client";

import { Copy, ExternalLink, KeyRound, MonitorPlay, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Checkbox, Switch } from "@/shared/ui/controls";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { LazyDialog } from "@/shared/ui/lazy-overlays";
import { Badge, Card, CardContent, EmptyState, Skeleton } from "@/shared/ui/primitives";
import { QRCode } from "@/shared/ui/qr-code";

import { type Paired, type Screen, useDeleteScreen, useReplaceToken, useSaveScreen, useScreens } from "./api";

const ROTATIONS = [10, 15, 20, 30, 60, 120] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** A TV that read its board in the last few minutes counts as on. */
const ONLINE_MS = 3 * 60_000;

/** /wallboards: TV screens for the sales floor (Tier 3, 8h). Pair a TV by opening a link or scanning a code. */
export function WallboardsPage() {
  const t = useTranslations("wallboard");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const { byId } = useClients();
  const list = useScreens();
  const replace = useReplaceToken();
  const remove = useDeleteScreen();
  const [editing, setEditing] = useState<Screen | "new" | null>(null);
  const [paired, setPaired] = useState<Paired | null>(null);
  const rows = list.data?.data ?? [];
  const now = Date.now();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MonitorPlay className="text-accent size-6" aria-hidden />
            {t("title")}
          </h1>
          <p className="text-muted max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </header>

      {list.isPending ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={MonitorPlay} title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((s) => {
            const online = s.last_seen_at && now - new Date(s.last_seen_at).getTime() < ONLINE_MS;
            return (
              <li key={s.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 pt-4" data-testid="wallboard-row">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        <Badge tone={online ? "success" : "neutral"}>{online ? t("online") : t("offline")}</Badge>
                      </div>
                      <p className="text-muted text-sm">
                        {s.client_ids.length === 0
                          ? t("allClients")
                          : s.client_ids.map((id) => byId.get(id)?.name ?? "—").join(", ")}
                        {" · "}
                        {t("rotateEvery", { seconds: s.rotate_seconds })}
                        {s.dim_from != null && s.dim_to != null && (
                          <>
                            {" · "}
                            {t("dims", { from: s.dim_from, to: s.dim_to })}
                          </>
                        )}
                      </p>
                      <p className="text-muted text-xs">
                        {s.last_seen_at ? t("lastSeen", { when: f.dateTime(s.last_seen_at, tz) }) : t("neverSeen")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        <Pencil aria-hidden />
                        {t("edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={replace.isPending && replace.variables === s.id}
                        onClick={() =>
                          window.confirm(t("confirmReplace")) &&
                          replace.mutate(s.id, { onSuccess: setPaired, onError: () => toast.error(t("failed")) })
                        }
                      >
                        <KeyRound aria-hidden />
                        {t("newLink")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        aria-label={t("deleteNamed", { name: s.name })}
                        onClick={() =>
                          window.confirm(t("confirmDelete", { name: s.name })) &&
                          remove.mutate(s.id, { onSuccess: () => toast.success(t("deleted")) })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted text-xs">{t("privacy")}</p>

      <LazyDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? t("new") : t("editTitle")}
      >
        {editing !== null && (
          <ScreenForm
            screen={editing === "new" ? null : editing}
            onDone={(p) => {
              setEditing(null);
              if (p) setPaired(p);
            }}
          />
        )}
      </LazyDialog>
      <LazyDialog open={paired !== null} onOpenChange={(o) => !o && setPaired(null)} title={t("pairTitle")}>
        {paired && <PairPanel paired={paired} />}
      </LazyDialog>
    </div>
  );
}

function ScreenForm({ screen, onDone }: { screen: Screen | null; onDone: (p: Paired | null) => void }) {
  const t = useTranslations("wallboard");
  const te = useTranslations("errors");
  const f = useFormat();
  const { clients } = useClients();
  const save = useSaveScreen();
  const [name, setName] = useState(screen?.name ?? "");
  const [ids, setIds] = useState<string[]>(screen?.client_ids ?? []);
  const [rotate, setRotate] = useState(screen?.rotate_seconds ?? 20);
  const [dim, setDim] = useState(screen ? screen.dim_from != null : true);
  const [from, setFrom] = useState(screen?.dim_from ?? 20);
  const [to, setTo] = useState(screen?.dim_to ?? 7);
  const [leaderboard, setLeaderboard] = useState(screen?.show_leaderboard ?? true);
  const [error, setError] = useState<string | null>(null);
  const hour = (h: number) => f.dateTime(`2026-01-05T${String(h).padStart(2, "0")}:00:00Z`, "UTC", "time");

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate(
          {
            id: screen?.id,
            body: {
              name: name.trim(),
              client_ids: ids,
              rotate_seconds: rotate,
              dim_from: dim ? from : null,
              dim_to: dim ? to : null,
              show_leaderboard: leaderboard,
              ...(screen ? { timezone: screen.timezone } : {}),
            },
          },
          {
            onSuccess: (r) => {
              toast.success(screen ? t("saved") : t("created"));
              onDone("token" in r ? r : null);
            },
            onError: (err) =>
              setError(
                isApiError(err) && te.has(err.code) ? te(err.code) : isApiError(err) ? err.message : t("failed"),
              ),
          },
        );
      }}
    >
      <Field label={t("name")}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder={t("namePlaceholder")}
        />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("clients")}</legend>
        <p className="text-muted -mt-1 mb-1.5 text-xs">{t("clientsHint")}</p>
        <div className="flex max-h-44 flex-wrap gap-x-3 gap-y-1.5 overflow-y-auto">
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ids.includes(c.id)}
                disabled={!ids.includes(c.id) && ids.length >= 12}
                onCheckedChange={(v) => setIds(v ? [...ids, c.id] : ids.filter((x) => x !== c.id))}
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        {/* Rotation and the night-dim switch share a row; the dim hours open underneath. */}
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <Field label={t("rotate")}>
            <NativeSelect value={rotate} onChange={(e) => setRotate(Number(e.target.value))}>
              {ROTATIONS.map((s) => (
                <option key={s} value={s}>
                  {t("seconds", { count: s })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex h-10 items-center justify-between gap-3 text-sm font-medium">
            {t("dim")}
            <Switch checked={dim} onCheckedChange={setDim} aria-label={t("dim")} />
          </div>
        </div>
        {dim && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("dimFrom")}>
              <NativeSelect value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hour(h)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("dimTo")}>
              <NativeSelect value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hour(h)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="grid gap-0.5">
          <span className="font-medium">{t("leaderboard")}</span>
          <span id="wb-lb-hint" className="text-muted text-xs">
            {t("leaderboardHint")}
          </span>
        </span>
        <Switch
          checked={leaderboard}
          onCheckedChange={setLeaderboard}
          aria-label={t("leaderboard")}
          aria-describedby="wb-lb-hint"
        />
      </div>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <Button type="submit" loading={save.isPending} className="justify-self-start">
        {screen ? t("save") : t("create")}
      </Button>
    </form>
  );
}

function PairPanel({ paired }: { paired: Paired }) {
  const t = useTranslations("wallboard");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paired.url);
      toast.success(t("copied"));
    } catch {
      toast.success(paired.url);
    }
  };
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <p className="text-muted text-sm">{t("pairIntro", { name: paired.screen.name })}</p>
      <div className="rounded-lg bg-white p-2">
        <QRCode value={paired.url} label={t("qr")} />
      </div>
      <Field label={t("link")} className="w-full text-start">
        <Input readOnly value={paired.url} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={copy}>
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        <Button asChild variant="secondary">
          <a href={paired.url} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden />
            {t("open")}
          </a>
        </Button>
      </div>
      <p role="note" className="bg-warning-soft text-warning rounded-md px-3 py-2 text-xs">
        {t("shownOnce")}
      </p>
    </div>
  );
}
