import type { Stage } from "../api/hooks";

export const NEXT_STAGES: Record<Stage, Stage[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["won", "lost", "contacted"],
  won: [],
  lost: ["new"],
};

export function canMove(from: Stage, to: Stage) {
  return NEXT_STAGES[from].includes(to);
}

export function needsDialog(to: Stage) {
  return to === "contacted" || to === "lost" || to === "won";
}
