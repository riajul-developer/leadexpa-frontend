"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePlanLimit } from "@/shared/lib/plan-limit";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/overlays";

export { BillingPage } from "./components/billing-page";
export { usePlanLimit };

export function PlanLimitDialog() {
  const t = useTranslations("billing.limit");
  const tf = useTranslations("billing.feature");
  const tl = useTranslations("billing.limits");
  const { limit, hide } = usePlanLimit();
  if (!limit) return null;
  const what = limit.feature ? tf(limit.feature) : limit.limit ? tl(limit.limit) : "";
  return (
    <Dialog open onOpenChange={(o) => !o && hide()}>
      <DialogContent
        title={limit.trial_expired ? t("trialEnded") : t("title")}
        description={
          limit.feature
            ? t("feature", { feature: what, plan: limit.plan })
            : t("limit", { limit: what, max: limit.max ?? 0, plan: limit.plan })
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={hide}>
            {t("notNow")}
          </Button>
          <Button asChild>
            <a href="mailto:sales@leadexpa.com?subject=Upgrade" onClick={hide}>
              <Sparkles aria-hidden />
              {t("contact")}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
