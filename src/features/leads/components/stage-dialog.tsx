"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { parseMoney } from "@/shared/lib/format";
import { StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Dialog, DialogContent } from "@/shared/ui/overlays";

import { useChangeStage, type Lead, type Outcome, type Stage } from "../api/hooks";

const LOST_REASONS = [
  "not_interested",
  "price",
  "no_response",
  "bought_elsewhere",
  "wrong_number",
  "duplicate",
  "other",
] as const;
const CONTACT_OUTCOMES: Outcome[] = ["connected", "interested", "callback_requested", "no_answer"];

export function StageDialog({
  lead,
  to,
  currency,
  onClose,
}: {
  lead: Pick<Lead, "id" | "version" | "stage" | "full_name">;
  to: Stage;
  currency: string;
  onClose: () => void;
}) {
  const t = useTranslations("stageDialog");
  const to_ = useTranslations("outcome");
  const tr = useTranslations("lostReason");
  const tv = useTranslations("validation");
  const change = useChangeStage(lead);
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("connected");
  const [amount, setAmount] = useState("");
  const amountMinor = amount ? parseMoney(amount, currency) : null;
  const invalidAmount = amount !== "" && amountMinor === null;

  const submit = (withSale: boolean) => {
    change.mutate(
      {
        to,
        lost_reason: to === "lost" ? (reason === "other" ? other.trim() || "other" : reason) : undefined,
        activity: to === "contacted" ? { type: "call", outcome } : undefined,
        sale: to === "won" && withSale && amountMinor ? { amount_minor: amountMinor, currency } : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("title", { name: lead.full_name || "—" })}
        description={
          <span className="inline-flex items-center gap-2">
            <StageBadge stage={lead.stage} /> → <StageBadge stage={to} />
          </span>
        }
      >
        {to === "contacted" && (
          <Field label={t("howContacted")}>
            <NativeSelect value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
              {CONTACT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {to_(o)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {to === "lost" && (
          <div className="grid gap-3">
            <Field label={t("reason")}>
              <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)}>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {reason === "other" && (
              <Field label={t("otherReason")}>
                <Input maxLength={200} value={other} onChange={(e) => setOther(e.target.value)} />
              </Field>
            )}
          </div>
        )}
        {to === "won" && (
          <Field
            label={t("saleAmount", { currency })}
            hint={t("saleHint")}
            error={invalidAmount ? tv("amount") : undefined}
          >
            <Input
              inputMode="decimal"
              placeholder="৳ 5,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          {to === "won" ? (
            <>
              <Button variant="secondary" onClick={() => submit(false)} loading={change.isPending && !amountMinor}>
                {t("wonWithoutSale")}
              </Button>
              <Button
                variant="success"
                disabled={!amountMinor}
                onClick={() => submit(true)}
                loading={change.isPending && !!amountMinor}
              >
                {t("wonWithSale")}
              </Button>
            </>
          ) : (
            <Button
              variant={to === "lost" ? "danger" : "primary"}
              onClick={() => submit(false)}
              loading={change.isPending}
            >
              {t("confirm")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
