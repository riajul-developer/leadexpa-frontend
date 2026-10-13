"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Dialog, DialogContent, Progress } from "@/shared/ui/overlays";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { type Meter, useSetBudget, useUsage } from "../api";

/** Metered usage this month (UTC) with per-meter budgets: alerts at 80 % and 100 %, never a cut-off. */
export function UsageCard({ canManage }: { canManage: boolean }) {
  const t = useTranslations("billing.usage");
  const f = useFormat();
  const usage = useUsage();
  const [editing, setEditing] = useState<{ meter: Meter; budget: number | null } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted text-sm">{t("hint")}</p>
        {!usage.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {usage.data.meters.map((m) => (
              <li key={m.meter} className="grid gap-1.5" data-meter={m.meter}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{t(`meter.${m.meter}`)}</span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({ meter: m.meter, budget: m.budget })}
                      aria-label={t("editBudgetFor", { meter: t(`meter.${m.meter}`) })}
                    >
                      <Pencil aria-hidden />
                      {m.budget == null ? t("setBudget") : t("editBudget")}
                    </Button>
                  )}
                </div>
                {m.budget != null && m.percent != null ? (
                  <>
                    <Progress
                      value={Math.min(m.percent, 100)}
                      tone={m.percent >= 100 ? "danger" : m.percent >= 80 ? "warning" : "primary"}
                      label={t(`meter.${m.meter}`)}
                    />
                    <p className="text-muted text-xs tabular-nums">
                      {t("ofBudget", {
                        used: f.number(m.used),
                        budget: f.number(m.budget),
                        percent: f.number(m.percent),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-muted text-xs tabular-nums">{t("usedNoBudget", { used: f.number(m.used) })}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && <BudgetDialog {...editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function BudgetDialog({ meter, budget, onClose }: { meter: Meter; budget: number | null; onClose: () => void }) {
  const t = useTranslations("billing.usage");
  const set = useSetBudget();
  const [value, setValue] = useState(budget == null ? "" : String(budget));
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(n) && n > 0;

  function save(limit: number | null) {
    set.mutate(
      { meter, limit },
      {
        onSuccess: () => {
          toast.success(limit == null ? t("removed") : t("saved"));
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("budgetTitle", { meter: t(`meter.${meter}`) })} description={t("budgetHint")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save(n);
          }}
        >
          <Field label={t("monthlyLimit")} error={value && !valid ? t("invalid") : undefined}>
            <Input
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
              autoFocus
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {budget != null && (
              <Button type="button" variant="ghost" onClick={() => save(null)} disabled={set.isPending}>
                {t("remove")}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!valid} loading={set.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
