import type { useTranslations } from "next-intl";

import type { RuleInput } from "./api";

type T = ReturnType<typeof useTranslations<"automations">>;

export function describeRule(t: T, r: Pick<RuleInput, "event" | "conditions" | "actions">): string {
  return t("summary", {
    event: t(`event.${r.event.replace(".", "_")}`),
    count: r.conditions.rules.length,
    actions: r.actions.map((a) => t(`action.${a.type}`)).join(", "),
  });
}

export function ruleLines(t: T, d: RuleInput): string[] {
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
  return [
    `${t("builder.name")}: ${d.name}`,
    `${t("builder.when")}: ${t(`event.${d.event.replace(".", "_")}`)}`,
    `${t("builder.if")}: ${t(d.conditions.match === "any" ? "builder.matchAny" : "builder.matchAll")}`,
    ...d.conditions.rules.map(
      (c) =>
        `  ${c.field.startsWith("custom.") ? c.field : t(`field.${c.field.replace(".", "_")}`)} ${t(`op.${c.op}`)} ${show(c.value)}`,
    ),
    `${t("builder.then")}:`,
    ...d.actions.map((a) => {
      const { type, ...params } = a;
      const detail = Object.values(params).map(show).filter(Boolean).join(" · ");
      return `  ${t(`action.${type}`)}${detail ? `: ${detail}` : ""}`;
    }),
    `${t("builder.rate")}: ${d.rate_per_hour ?? 100}`,
  ];
}
