"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LOCALE_NAMES } from "@/shared/config/locales";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useClients } from "@/shared/lib/lookups";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";

import { type AskPeriod, useShareTemplate } from "./api";

export const REPORT_LOCALES = ["en", "bn", "ar"] as const;

export function ShareDialog({
  templateId,
  defaultClient,
  period,
}: {
  templateId: string;
  defaultClient: string;
  period: AskPeriod;
}) {
  const t = useTranslations("reportBuilder.shareDialog");
  const te = useTranslations("errors");
  const f = useFormat();
  const current = useLocale();
  const { clients } = useClients();
  const [clientId, setClientId] = useState(defaultClient || clients[0]?.id || "");
  const [lang, setLang] = useState<string>(REPORT_LOCALES.includes(current as "en") ? current : "en");
  const share = useShareTemplate(templateId);
  const url = share.data?.url;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.success(url);
    }
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        share.mutate(
          { client_id: clientId, period, locale: lang },
          { onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : t("failed")) },
        );
      }}
    >
      <p className="text-muted text-sm">{t("intro")}</p>
      <Field label={t("client")}>
        <NativeSelect value={clientId} onChange={(e) => (setClientId(e.target.value), share.reset())} required>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("language")}>
        <NativeSelect value={lang} onChange={(e) => (setLang(e.target.value), share.reset())}>
          {REPORT_LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {url ? (
        <div className="grid gap-2">
          <Field label={t("link")} hint={t("expires", { date: f.dateTime(share.data!.expires_at, "UTC", "date") })}>
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy}>
              <Copy aria-hidden />
              {t("copy")}
            </Button>
            <Button asChild variant="secondary">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                {t("open")}
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <Button type="submit" loading={share.isPending} disabled={!clientId}>
          {t("create")}
        </Button>
      )}
    </form>
  );
}
