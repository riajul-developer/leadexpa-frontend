"use client";

import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/input";

import { useEnroll, useLeadEnrollments, useSequences, useStopEnrollment } from "./api";
import { describeStep } from "./describe";

export function EnrollmentCard({ lead }: { lead: { id: string; client_id: string; do_not_contact: boolean } }) {
  const t = useTranslations("sequences");
  const te = useTranslations("errors");
  const f = useFormat();
  const q = useLeadEnrollments(lead.id);
  const seqs = useSequences(lead.client_id);
  const enroll = useEnroll(lead.id);
  const stop = useStopEnrollment(lead.id);
  const [pick, setPick] = useState("");
  const active = q.data?.data.find((e) => e.status === "active");
  const used = new Set(q.data?.data.map((e) => e.sequence_id));
  const options = (seqs.data?.data ?? []).filter(
    (s) => s.status === "active" && !used.has(s.id) && (!s.client_id || s.client_id === lead.client_id),
  );
  const fail = (e: unknown) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal"));
  if (q.isPending) return null;
  if (!active && (lead.do_not_contact || options.length === 0)) return null;
  return (
    <section aria-labelledby="enrollment-h" className="border-border grid gap-2 rounded-lg border p-3 text-sm">
      <h2 id="enrollment-h" className="flex items-center gap-2 font-semibold">
        <Repeat className="text-primary size-4" aria-hidden />
        {t("lead.title")}
      </h2>
      {active ? (
        <>
          <p>
            {active.sequence_name} · {t("lead.step", { n: active.step_no + 1, total: active.step_count })}
          </p>
          {active.next_step && active.next_step_at && (
            <p className="text-muted">
              {t("lead.next", {
                step: describeStep(t, active.next_step),
                when: f.relative(active.next_step_at, Date.now()),
              })}
            </p>
          )}
          <div>
            <Button
              size="sm"
              variant="secondary"
              loading={stop.isPending}
              onClick={() =>
                stop.mutate(active.id, { onSuccess: () => toast.success(t("lead.stopped")), onError: fail })
              }
            >
              {t("lead.stop")}
            </Button>
          </div>
        </>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pick)
              enroll.mutate(pick, {
                onSuccess: () => {
                  toast.success(t("lead.enrolled"));
                  setPick("");
                },
                onError: fail,
              });
          }}
        >
          <NativeSelect
            aria-label={t("lead.pick")}
            className="min-w-48 flex-1"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">{t("lead.pick")}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" disabled={!pick} loading={enroll.isPending}>
            {t("lead.add")}
          </Button>
        </form>
      )}
    </section>
  );
}
