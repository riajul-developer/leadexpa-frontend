import { describe, expect, it } from "vitest";

import type { ReportWidget } from "./api";
import { compact, fitQuery, freeSpot, fromStarter, newWidget, overlaps, place, problem, STARTERS } from "./grid";

const w = (id: string, x: number, y: number, ww: number, h: number): ReportWidget => ({
  id,
  type: "text",
  title: "",
  text: "x",
  query: null,
  layout: { x, y, w: ww, h },
});

const noOverlaps = (ws: ReportWidget[]) =>
  ws.every((a, i) => ws.every((b, j) => i === j || !overlaps(a.layout, b.layout)));

describe("report builder grid", () => {
  it("pushes what a moved widget lands on below it", () => {
    const ws = [w("a", 0, 0, 6, 2), w("b", 6, 0, 6, 2), w("c", 0, 2, 12, 2)];
    const out = place(ws, "c", { x: 0, y: 0, w: 12, h: 2 });
    expect(noOverlaps(out)).toBe(true);
    expect(out.find((x) => x.id === "c")!.layout).toEqual({ x: 0, y: 0, w: 12, h: 2 });
    expect(out.find((x) => x.id === "a")!.layout.y).toBe(2);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]); // order kept
  });

  it("clamps to the grid and floats the rest up", () => {
    const ws = [w("a", 0, 0, 4, 2), w("b", 0, 5, 4, 2)];
    const out = place(ws, "a", { x: 11, y: -3, w: 4, h: 20 });
    expect(out.find((x) => x.id === "a")!.layout).toEqual({ x: 8, y: 0, w: 4, h: 12 });
    expect(out.find((x) => x.id === "b")!.layout.y).toBe(0);
    expect(noOverlaps(out)).toBe(true);
  });

  it("compacts after a delete and finds a free spot for a new widget", () => {
    expect(compact([w("a", 0, 4, 6, 2)])[0]!.layout.y).toBe(0);
    const ws = [w("a", 0, 0, 6, 2)];
    expect(freeSpot(ws, 6, 2)).toEqual({ x: 6, y: 0, w: 6, h: 2 });
    expect(freeSpot(ws, 12, 1)).toEqual({ x: 0, y: 2, w: 12, h: 1 });
    expect(newWidget("kpi", ws).layout).toEqual({ x: 6, y: 0, w: 3, h: 2 });
  });

  it("reshapes a query when the type changes", () => {
    const table = fitQuery("table", null)!;
    const many = { ...table, metrics: ["leads", "won", "revenue"] as typeof table.metrics, by: "owner" as const };
    expect(fitQuery("kpi", many)).toMatchObject({ metrics: ["leads"], by: "none" });
    expect(fitQuery("line", many)).toMatchObject({ metrics: ["leads", "won", "revenue"], by: "day" });
    expect(fitQuery("bar", many)).toMatchObject({ metrics: ["leads", "won"], by: "owner" });
    expect(fitQuery("leads", many)).toMatchObject({ kind: "leads", metrics: [], by: "" });
    expect(fitQuery("text", many)).toBeNull();
  });

  it("starters are valid layouts the server accepts", () => {
    for (const key of Object.keys(STARTERS) as (keyof typeof STARTERS)[]) {
      const ws = fromStarter(key);
      expect(noOverlaps(ws)).toBe(true);
      expect(ws.every((x) => problem(x) === null && x.layout.x + x.layout.w <= 12)).toBe(true);
    }
  });
});
