// Not a client module: server code would get client references, not arrays.
export const ONBOARDING_STEPS = ["agency", "client", "sla", "source", "team", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
