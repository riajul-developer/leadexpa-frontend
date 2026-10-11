import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ONBOARDING_STEPS, Onboarding, type OnboardingStep } from "@/features/onboarding";

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!ONBOARDING_STEPS.includes(step as OnboardingStep)) notFound();
  return <Onboarding step={step as OnboardingStep} />;
}
