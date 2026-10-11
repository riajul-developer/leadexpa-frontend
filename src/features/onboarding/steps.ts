// Plain module (not "use client"): the server route validates the step with this list. Values exported from a
// client module reach server code as client references, not arrays.
export const ONBOARDING_STEPS = ["agency", "client", "sla", "source", "team", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
