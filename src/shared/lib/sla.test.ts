import { describe, expect, it } from "vitest";

import { needsFineTick, slaView, type SlaInput } from "./sla";

const now = Date.parse("2026-10-11T10:00:00Z");
const base: SlaInput = {
  sla: null,
  received_at: "2026-10-11T09:50:00Z",
  first_response_at: null,
  next_callback_at: null,
  stage: "new",
};
const due = (iso: string, status: "on_track" | "due_soon" | "overdue" | "met" = "on_track") => ({
  sla: { status, due_at: iso, kind: "first_response" },
});

describe("slaView", () => {
  it("counts down an on-track timer", () => {
    const v = slaView({ ...base, ...due("2026-10-11T10:12:00Z") }, now);
    expect(v).toMatchObject({ state: "on_track", seconds: 720 });
    expect(needsFineTick(v)).toBe(false);
  });

  it("turns due soon in the last minutes even if the server said on_track", () => {
    const v = slaView({ ...base, ...due("2026-10-11T10:03:00Z") }, now);
    expect(v.state).toBe("due_soon");
    expect(needsFineTick(v)).toBe(true);
  });

  it("becomes overdue the moment the deadline passes", () => {
    expect(slaView({ ...base, ...due("2026-10-11T09:42:00Z") }, now)).toMatchObject({
      state: "overdue",
      seconds: 1080,
    });
  });

  it("shows the response time once met", () => {
    const v = slaView(
      {
        ...base,
        first_response_at: "2026-10-11T09:54:00Z",
        sla: { status: "met", due_at: null, kind: "first_response" },
      },
      now,
    );
    expect(v).toMatchObject({ state: "met", seconds: 240 });
  });

  it("shows a future callback as paused", () => {
    const v = slaView(
      {
        ...base,
        stage: "contacted",
        first_response_at: "2026-10-11T09:54:00Z",
        next_callback_at: "2026-10-11T15:30:00Z",
        sla: { status: "met", due_at: null, kind: null },
      },
      now,
    );
    expect(v).toMatchObject({ state: "paused", at: "2026-10-11T15:30:00Z" });
  });

  it("has no chip for closed leads or leads without an SLA", () => {
    expect(slaView({ ...base, ...due("2026-10-11T09:00:00Z"), stage: "won" }, now).state).toBe("none");
    expect(slaView(base, now).state).toBe("none");
  });
});
