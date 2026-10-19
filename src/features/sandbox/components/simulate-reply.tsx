"use client";

import { MessageCircleReply } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { isApiError } from "@/shared/lib/api/errors";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/input";

import { useSandboxOf, useSimulateReply } from "../api";

export function SimulateReply({ leadId, hasPhone }: { leadId: string; hasPhone: boolean }) {
  const t = useTranslations("sandbox.reply");
  const inSandbox = useSandboxOf() !== null;
  const reply = useSimulateReply(leadId);
  const [text, setText] = useState("");
  const id = useId();
  if (!inSandbox || !hasPhone) return null;
  return (
    <form
      className="border-border bg-info-soft/40 grid gap-2 rounded-lg border p-3"
      data-testid="simulate-reply"
      onSubmit={(e) => {
        e.preventDefault();
        const body = text.trim();
        if (!body) return;
        reply.mutate(body, {
          onSuccess: () => {
            setText("");
            toast.success(t("sent"));
          },
          onError: (e) => toast.error(isApiError(e) && e.code === "no_channel_account" ? t("noNumber") : t("failed")),
        });
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {t("title")}
      </label>
      <p className="text-muted text-xs">{t("hint")}</p>
      <Textarea id={id} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      <div>
        <Button type="submit" size="sm" loading={reply.isPending} disabled={!text.trim()}>
          <MessageCircleReply aria-hidden />
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
