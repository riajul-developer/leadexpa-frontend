import type { useTranslations } from "next-intl";

import type { Step, Trigger } from "./api";

type T = ReturnType<typeof useTranslations<"sequences">>;

/** One line saying who a sequence picks up, e.g. "2 unanswered calls" or "Lost (price) 14 days ago". */
export function describeTrigger(
  t: T,
  tr: Trigger,
  reason: (r: string) => string,
  stage: (s: string) => string,
): string {
  switch (tr.kind) {
    case "no_answer":
      return t("trigger.summary.no_answer", { count: tr.attempts ?? 0 });
    case "stale":
      return t("trigger.summary.stale", {
        stages: (tr.stages ?? []).map(stage).join(", "),
        days: tr.days ?? 0,
      });
    case "lost":
      return t("trigger.summary.lost", { reasons: (tr.reasons ?? []).map(reason).join(", "), days: tr.days ?? 0 });
    default:
      return t("trigger.summary.manual");
  }
}

/** "Wait 1 day", "WhatsApp: lead_welcome", "Call task"… */
export function describeStep(t: T, s: Step): string {
  switch (s.type) {
    case "wait":
      return (s.hours ?? 0) % 24 === 0
        ? t("step.summary.waitDays", { count: (s.hours ?? 0) / 24 })
        : t("step.summary.waitHours", { count: s.hours ?? 0 });
    case "whatsapp_template":
      return t("step.summary.whatsapp", { template: s.template_name ?? "—" });
    default:
      return t(`step.type.${s.type}`);
  }
}
