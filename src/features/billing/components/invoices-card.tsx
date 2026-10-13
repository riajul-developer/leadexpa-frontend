"use client";

import { Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/shared/hooks/use-format";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { useInvoices } from "../api";

/** Stripe invoices (with VAT/GST shown separately) in the customer's currency. */
export function InvoicesCard() {
  const t = useTranslations("billing.invoices");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const invoices = useInvoices(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!invoices.data ? (
          <Skeleton className="h-16 w-full" />
        ) : invoices.data.data.length === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border grid divide-y">
            {invoices.data.data.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{inv.number || inv.id}</span>
                  <span className="text-muted text-xs">{f.dateTime(inv.created_at, tz, "date")}</span>
                </div>
                <div className="grid text-end tabular-nums">
                  <span className="font-medium">
                    {f.money({ amount_minor: inv.total_minor, currency: inv.currency })}
                  </span>
                  {inv.tax_minor > 0 && (
                    <span className="text-muted text-xs">
                      {t("tax", { amount: f.money({ amount_minor: inv.tax_minor, currency: inv.currency }) })}
                    </span>
                  )}
                </div>
                <Badge tone={inv.status === "paid" ? "success" : inv.status === "open" ? "warning" : "neutral"}>
                  {t.has(`status.${inv.status}`) ? t(`status.${inv.status}`) : inv.status}
                </Badge>
                <div className="flex gap-1">
                  {inv.hosted_url && (
                    <a
                      href={inv.hosted_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:bg-surface-2 rounded-md p-2"
                      aria-label={t("view", { number: inv.number || inv.id })}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}
                  {inv.pdf_url && (
                    <a
                      href={inv.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:bg-surface-2 rounded-md p-2"
                      aria-label={t("download", { number: inv.number || inv.id })}
                    >
                      <Download className="size-4" aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
