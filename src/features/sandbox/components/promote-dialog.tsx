"use client";

import { ArrowUpFromLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/controls";
import { Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Skeleton } from "@/shared/ui/primitives";

import { type SandboxChange, usePromote, usePromotePreview } from "../api";

const key = (c: Pick<SandboxChange, "kind" | "sandbox_id">) => `${c.kind}:${c.sandbox_id}`;

/** Picks sandbox changes to apply to the live workspace (ADR 0059). Conflicts are listed but can't be picked. */
export function PromoteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("sandbox.promote");
  const q = usePromotePreview();
  const promote = usePromote();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const changes = q.data?.changes ?? [];
  const pickable = changes.filter((c) => c.change !== "conflict");
  const toggle = (k: string, on: boolean) =>
    setPicked((old) => {
      const next = new Set(old);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const errorFor = (e: unknown) =>
    isApiError(e) && e.code === "promote_conflict"
      ? t("errors.conflict")
      : isApiError(e) && e.code === "promote_unavailable"
        ? t("errors.unavailable")
        : isApiError(e) && e.status === 422
          ? t("errors.dependency")
          : t("errors.failed");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("title")} description={t("hint")} className="max-w-2xl">
        {q.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : q.data && !q.data.available ? (
          <p className="text-muted text-sm">{t("unavailable")}</p>
        ) : changes.length === 0 ? (
          <p className="text-muted text-sm">{t("none")}</p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(undefined);
              const refs = changes
                .filter((c) => picked.has(key(c)))
                .map(({ kind, sandbox_id }) => ({ kind, sandbox_id }));
              promote.mutate(refs, {
                onSuccess: () => {
                  track("sandbox.promoted", { count: refs.length });
                  toast.success(t("done", { count: refs.length }));
                  setPicked(new Set());
                },
                onError: (e) => setError(errorFor(e)),
              });
            }}
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={pickable.length > 0 && pickable.every((c) => picked.has(key(c)))}
                onCheckedChange={(on) => setPicked(on === true ? new Set(pickable.map(key)) : new Set())}
                disabled={pickable.length === 0}
              />
              {t("all")}
            </label>
            <ul className="divide-border border-border divide-y rounded-md border" data-testid="promote-changes">
              {changes.map((c) => {
                const conflict = c.change === "conflict";
                return (
                  <li key={key(c)}>
                    <label
                      className={`flex items-start gap-3 px-3 py-2.5 ${conflict ? "opacity-80" : "cursor-pointer"}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={picked.has(key(c))}
                        disabled={conflict}
                        onCheckedChange={(on) => toggle(key(c), on === true)}
                        aria-label={c.name}
                      />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{c.name}</span>
                          <Badge tone={conflict ? "danger" : c.change === "added" ? "success" : "info"}>
                            {t(`change.${c.change}`)}
                          </Badge>
                        </span>
                        <span className="text-muted text-xs">
                          {t(`kind.${c.kind}`)}
                          {c.fields.length > 0 && ` · ${t("fields", { fields: c.fields.join(", ") })}`}
                        </span>
                        {conflict && <span className="text-danger text-xs">{t("conflictHint")}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted text-xs">{t("safety")}</p>
            {error && (
              <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={promote.isPending} disabled={picked.size === 0}>
                <ArrowUpFromLine aria-hidden />
                {t("apply", { count: picked.size })}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
