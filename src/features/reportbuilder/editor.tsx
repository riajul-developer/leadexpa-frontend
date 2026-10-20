"use client";

import { ArrowLeft, CalendarClock, LayoutGrid, Plus, Save, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { PRESETS } from "@/shared/lib/report-query";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input, NativeSelect } from "@/shared/ui/input";
import { LazyDialog, LazySheet } from "@/shared/ui/lazy-overlays";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/overlays";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type AskPeriod, type ReportWidget, useRunWidgets, useSaveTemplate, useTemplate } from "./api";
import { Board } from "./board";
import {
  compact,
  fromStarter,
  MAX_WIDGETS,
  newWidget,
  place,
  problem,
  type Starter,
  STARTERS,
  WIDGET_TYPES,
} from "./grid";
import { ScheduleSheet } from "./schedules";
import { ShareDialog } from "./share-dialog";
import { WidgetSettings } from "./widget-settings";
import { autoTitle, WidgetView } from "./widget-view";

type Preset = AskPeriod["preset"];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function ReportEditor({ templateId }: { templateId: string }) {
  const t = useTranslations("reportBuilder");
  const ta = useTranslations("ask");
  const te = useTranslations("errors");
  const router = useRouter();
  const params = useSearchParams();
  const isNew = templateId === "new";
  const canEdit = useCan("report.share");
  const existing = useTemplate(isNew ? undefined : templateId);
  const save = useSaveTemplate();
  const { clients } = useClients();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [preset, setPreset] = useState<Preset>("last_30_days");
  const [share, setShare] = useState(false);
  const [schedules, setSchedules] = useState(false);
  const [nameError, setNameError] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    if (isNew) {
      const starter = params.get("starter") as Starter | null;
      if (starter && starter in STARTERS) {
        setWidgets(fromStarter(starter));
        setName(t(`starters.${starter}.name`));
        setDescription(t(`starters.${starter}.description`));
      }
      loaded.current = true;
    } else if (existing.data) {
      setName(existing.data.name);
      setDescription(existing.data.description);
      setWidgets(existing.data.widgets);
      loaded.current = true;
    }
  }, [isNew, existing.data, params, t]);

  const edit = (next: ReportWidget[]) => {
    setWidgets(next);
    setDirty(true);
  };

  const runnable = useMemo(() => widgets.filter((w) => !problem(w)), [widgets]);
  const queries = useDebounced(
    useMemo(() => runnable.map((w) => ({ ...w, title: "", text: w.type === "text" ? w.text : "" })), [runnable]),
    350,
  );
  const period = useMemo(() => ({ preset, from: "", to: "" }), [preset]);
  const run = useRunWidgets(queries, clientId, period);
  const results = useMemo(() => new Map((run.data?.results ?? []).map((r) => [r.id, r])), [run.data]);

  const errorText = (e: unknown) =>
    isApiError(e) && te.has(e.code) ? te(e.code) : isApiError(e) ? e.message : t("failed");

  const onSave = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const bad = widgets.find((w) => problem(w));
    if (bad) {
      setSelected(bad.id);
      toast.error(t("fixWidget"));
      return;
    }
    save.mutate(
      { id: isNew ? undefined : templateId, body: { name: name.trim(), description: description.trim(), widgets } },
      {
        onSuccess: (saved) => {
          setDirty(false);
          toast.success(t("savedToast"));
          if (isNew) router.replace(`/report-builder/${saved.id}`);
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );
  };

  const add = (type: (typeof WIDGET_TYPES)[number]) => {
    const w = newWidget(type, widgets, type === "text" ? t("defaultText") : "");
    edit([...widgets, w]);
    setSelected(w.id);
  };

  if (!isNew && existing.isPending) return <Skeleton className="m-6 h-96" />;
  if (!isNew && existing.isError)
    return (
      <div className="p-6">
        <EmptyState title={t("notFound")} />
      </div>
    );

  const current = widgets.find((w) => w.id === selected);
  const savedId = isNew ? null : templateId;
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 md:p-6">
      <header className="relative flex flex-wrap items-start gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="hover:text-primary mt-[5px] h-8 w-auto px-0 hover:bg-transparent active:bg-transparent md:absolute md:end-full md:top-0 md:me-1"
          aria-label={t("back")}
        >
          <Link href="/report-builder">
            <ArrowLeft aria-hidden className="rtl:rotate-180" />
          </Link>
        </Button>
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="sr-only">{name || t("newReport")}</h1>
          <div
            className={cn(
              "grid rounded-lg border border-transparent px-2 py-1 transition-[border-color,box-shadow,background-color] duration-150",
              canEdit &&
                "border-border bg-surface focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-primary)_16%,transparent)]",
              nameError && "border-danger",
            )}
          >
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
                setDirty(true);
              }}
              aria-label={t("name")}
              aria-invalid={nameError}
              placeholder={t("namePlaceholder")}
              maxLength={120}
              readOnly={!canEdit}
              className="h-auto rounded-none border-0 bg-transparent px-0 py-0.5 text-xl font-semibold shadow-none hover:border-0 focus-visible:shadow-none"
            />
            <Input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              aria-label={t("description")}
              placeholder={t("descriptionPlaceholder")}
              maxLength={500}
              readOnly={!canEdit}
              className="text-muted h-auto rounded-none border-0 bg-transparent px-0 py-0.5 text-sm shadow-none hover:border-0 focus-visible:shadow-none"
            />
          </div>
          {nameError && (
            <p role="alert" className="text-danger px-2 text-sm">
              {t("nameRequired")}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setSchedules(true)}
              disabled={!savedId || dirty}
              title={!savedId || dirty ? t("saveFirst") : undefined}
            >
              <CalendarClock aria-hidden />
              {t("schedule")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShare(true)}
              disabled={!savedId || dirty}
              title={!savedId || dirty ? t("saveFirst") : undefined}
            >
              <Share2 aria-hidden />
              {t("share")}
            </Button>
            <Button onClick={onSave} loading={save.isPending} disabled={!dirty && !isNew}>
              <Save aria-hidden />
              {dirty || isNew ? t("save") : t("savedState")}
            </Button>
          </div>
        )}
      </header>

      <div
        className="bg-surface-2 flex flex-wrap items-center gap-2 rounded-xl p-2"
        role="toolbar"
        aria-label={t("toolbar")}
      >
        <NativeSelect
          className="h-9 w-auto"
          aria-label={t("previewClient")}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">{ta("chips.allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="h-9 w-auto"
          aria-label={ta("chips.period")}
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
        >
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {ta(`period.${p}`)}
            </option>
          ))}
        </NativeSelect>
        {run.data?.period && (
          <span className="text-muted text-xs">
            {ta("periodLine", { from: run.data.period.from, to: run.data.period.to, zone: run.data.period.timezone })}
          </span>
        )}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="ms-auto" disabled={widgets.length >= MAX_WIDGETS}>
                <Plus aria-hidden />
                {t("addWidget")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {WIDGET_TYPES.map((k) => (
                <DropdownMenuItem key={k} onSelect={() => add(k)}>
                  <span className="grid">
                    <span>{t(`types.${k}`)}</span>
                    <span className="text-muted text-xs">{t(`typeHints.${k}`)}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {run.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(run.error)}
        </p>
      )}

      {widgets.length === 0 ? (
        <EmptyState icon={LayoutGrid} title={t("emptyTitle")} description={canEdit ? t("emptyHint") : undefined} />
      ) : (
        <Board
          widgets={widgets}
          label={t("board.label")}
          editable={canEdit}
          selected={selected}
          onSelect={setSelected}
          title={(w) => autoTitle(ta, t, w)}
          onPlace={(id, layout) => edit(place(widgets, id, layout))}
          onRemove={(id) => {
            edit(compact(widgets.filter((w) => w.id !== id)));
            if (selected === id) setSelected(null);
          }}
          render={(w) => {
            const r = results.get(w.id);
            return (
              <WidgetView
                widget={w}
                loading={run.isFetching || (!r && !problem(w))}
                data={r ? { metrics: r.metrics, count: r.leads?.count, preview: r.leads?.preview } : undefined}
              />
            );
          }}
        />
      )}
      {canEdit && widgets.length > 0 && <p className="text-muted hidden text-xs md:block">{t("board.hint")}</p>}

      <LazySheet
        open={!!current}
        onOpenChange={(o) => !o && setSelected(null)}
        title={t("settings.heading")}
        className="sm:max-w-md"
      >
        {current && (
          <WidgetSettings widget={current} onChange={(w) => edit(widgets.map((x) => (x.id === w.id ? w : x)))} />
        )}
      </LazySheet>
      {savedId && (
        <>
          <LazyDialog open={share} onOpenChange={setShare} title={t("shareDialog.title")}>
            <ShareDialog templateId={savedId} defaultClient={clientId} period={period} />
          </LazyDialog>
          <LazySheet open={schedules} onOpenChange={setSchedules} title={t("schedules.title", { name })}>
            <ScheduleSheet templateId={savedId} defaultClient={clientId} />
          </LazySheet>
        </>
      )}
    </div>
  );
}
