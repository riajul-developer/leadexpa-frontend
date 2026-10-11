import type { Stage } from "../api/hooks";

/** Transitions the API allows (backend changeLeadStage). */
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

/**
 * Moving to contacted needs a contact attempt (sent inline, atomically), lost needs a reason, won offers
 * recording the sale. Other moves apply directly.
 */
export function needsDialog(to: Stage) {
  return to === "contacted" || to === "lost" || to === "won";
}
