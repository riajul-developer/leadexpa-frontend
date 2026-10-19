"use client";

import { GripVertical, MoveDiagonal2, Settings2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { isRTL } from "@/shared/config/locales";
import { cn } from "@/shared/lib/cn";

import type { ReportWidget } from "./api";
import { clamp, type Layout, place, stacked } from "./grid";

/** Row height in px (desktop); on phones widgets stack in one column at h × this. */
export const ROW = 56;
const GAP = 12;

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; start: Layout; layout: Layout };

/**
 * The report grid: 12 columns × fixed rows from md up, one stacked column on phones (top-to-bottom reading order
 * in the DOM, which is also what screen readers follow). In edit mode a widget moves by its grip and resizes by
 * its corner, with the pointer or the keyboard (arrows move, Shift+arrows resize); whatever it lands on moves down.
 */
export function Board({
  widgets,
  title,
  render,
  editable = false,
  selected,
  onSelect,
  onPlace,
  onRemove,
  label,
}: {
  widgets: ReportWidget[];
  title: (w: ReportWidget) => string;
  render: (w: ReportWidget) => React.ReactNode;
  editable?: boolean;
  selected?: string | null;
  onSelect?: (id: string) => void;
  onPlace?: (id: string, layout: Layout) => void;
  onRemove?: (id: string) => void;
  label: string;
}) {
  const t = useTranslations("reportBuilder.board");
  const rtl = isRTL(useLocale());
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [said, setSaid] = useState("");

  // While dragging, show where everything would settle.
  const shown = drag ? place(widgets, drag.id, drag.layout) : widgets;

  const steps = () => {
    const el = ref.current;
    if (!el) return null;
    if (getComputedStyle(el).gridTemplateColumns.split(" ").length < 12) return null; // phone: one column
    const col = (el.clientWidth - GAP * 11) / 12 + GAP;
    return { col, row: ROW + GAP };
  };

  const begin = (e: React.PointerEvent, w: ReportWidget, mode: Drag["mode"]) => {
    if (!editable || e.button !== 0 || !steps()) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: w.id, mode, startX: e.clientX, startY: e.clientY, start: w.layout, layout: w.layout });
  };
  const move = (e: React.PointerEvent) => {
    const s = steps();
    if (!drag || !s) return;
    const dc = Math.round(((e.clientX - drag.startX) * (rtl ? -1 : 1)) / s.col);
    const dr = Math.round((e.clientY - drag.startY) / s.row);
    const l = drag.start;
    const next =
      drag.mode === "move" ? clamp({ ...l, x: l.x + dc, y: l.y + dr }) : clamp({ ...l, w: l.w + dc, h: l.h + dr });
    if (next.x !== drag.layout.x || next.y !== drag.layout.y || next.w !== drag.layout.w || next.h !== drag.layout.h)
      setDrag({ ...drag, layout: next });
  };
  const end = () => {
    if (!drag) return;
    const { id, layout, start } = drag;
    setDrag(null);
    if (layout.x !== start.x || layout.y !== start.y || layout.w !== start.w || layout.h !== start.h)
      onPlace?.(id, layout);
  };

  const keys = (e: React.KeyboardEvent, w: ReportWidget) => {
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [rtl ? 1 : -1, 0],
      ArrowRight: [rtl ? -1 : 1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    const l = w.layout;
    const next = e.shiftKey
      ? clamp({ ...l, w: l.w + d[0], h: l.h + d[1] })
      : clamp({ ...l, x: l.x + d[0], y: l.y + d[1] });
    if (next.x === l.x && next.y === l.y && next.w === l.w && next.h === l.h) return;
    onPlace?.(w.id, next);
    setSaid(e.shiftKey ? t("resized", { w: next.w, h: next.h }) : t("moved", { column: next.x + 1, row: next.y + 1 }));
  };

  return (
    <>
      {/* Rows are 56px but grow when a widget's content needs more (a horizontal bar chart with many rows). */}
      <div
        ref={ref}
        role="list"
        aria-label={label}
        className="grid grid-cols-1 gap-3 md:auto-rows-[minmax(56px,auto)] md:grid-cols-12"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {stacked(shown).map((w) => {
          const l = w.layout;
          const name = title(w);
          const active = selected === w.id;
          const dragging = drag?.id === w.id;
          return (
            <div
              key={w.id}
              role="listitem"
              data-testid={`rb-widget-${w.id}`}
              style={
                {
                  "--gc": `${l.x + 1} / span ${l.w}`,
                  "--gr": `${l.y + 1} / span ${l.h}`,
                  "--mh": `${l.h * ROW}px`,
                } as React.CSSProperties
              }
              className={cn(
                "border-border bg-surface shadow-card relative flex min-h-[var(--mh)] min-w-0 flex-col gap-2 rounded-xl border p-3 md:[grid-column:var(--gc)] md:[grid-row:var(--gr)] md:min-h-0",
                active && "ring-accent ring-2",
                dragging && "ring-primary z-10 opacity-90 shadow-lg ring-2",
              )}
            >
              {(name || editable) && (
                <div className="flex min-w-0 items-center gap-1">
                  {editable && (
                    <button
                      type="button"
                      className="text-muted hover:text-text focus-visible:ring-focus -ms-1 hidden cursor-grab touch-none rounded p-1 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing md:block"
                      aria-label={t("move", { name: name || t("untitled") })}
                      aria-describedby="rb-board-help"
                      onPointerDown={(e) => begin(e, w, "move")}
                      onKeyDown={(e) => keys(e, w)}
                    >
                      <GripVertical aria-hidden className="size-4" />
                    </button>
                  )}
                  <h3 className="min-w-0 flex-1 truncate text-sm font-medium" title={name}>
                    {name || <span className="text-muted">{t("untitled")}</span>}
                  </h3>
                  {editable && (
                    <>
                      <button
                        type="button"
                        className="text-muted hover:text-text hover:bg-surface-2 rounded p-1"
                        aria-label={t("edit", { name: name || t("untitled") })}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect?.(w.id);
                        }}
                      >
                        <Settings2 aria-hidden className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="text-muted hover:text-danger hover:bg-surface-2 rounded p-1"
                        aria-label={t("remove", { name: name || t("untitled") })}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove?.(w.id);
                        }}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-col">{render(w)}</div>
              {editable && (
                <span
                  aria-hidden
                  className="text-muted hover:text-text absolute end-0.5 bottom-0.5 hidden cursor-nwse-resize touch-none p-0.5 md:block rtl:cursor-nesw-resize"
                  onPointerDown={(e) => begin(e, w, "resize")}
                >
                  <MoveDiagonal2 className="size-3.5 rtl:-scale-x-100" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {editable && (
        <>
          <p id="rb-board-help" className="sr-only">
            {t("help")}
          </p>
          <p aria-live="polite" className="sr-only">
            {said}
          </p>
        </>
      )}
    </>
  );
}
