"use client";

import { FileUp, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type OfflineImportResult,
  type OfflineSale,
  useOfflineSales,
  useResolveOffline,
  useUploadOffline,
} from "./api";

export function ClientOfflineSales({ clientId, timeZone }: { clientId: string; timeZone: string }) {
  const t = useTranslations("revintel.offline");
  const te = useTranslations("errors");
  const canUpdate = useCan("lead.update");
  const upload = useUploadOffline(clientId);
  const review = useOfflineSales(clientId, "review");
  const recent = useOfflineSales(clientId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<OfflineImportResult | null>(null);
  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: setLast,
      onError: (e) =>
        toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : isApiError(e) ? e.message : t("failed")),
    });
    if (fileRef.current) fileRef.current.value = "";
  };
  const rows = review.data?.data ?? [];
  const matched = (recent.data?.data ?? []).filter((r) => r.status === "matched").slice(0, 20);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="text-accent size-5" aria-hidden />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted text-sm">{t("hint")}</p>
          <p className="text-muted text-xs">{t("columns")}</p>
          {canUpdate && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                id="offline-csv"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button asChild variant="secondary" loading={upload.isPending}>
                <label htmlFor="offline-csv">
                  <FileUp aria-hidden />
                  {t("upload")}
                </label>
              </Button>
              <span className="text-muted text-xs">{t("api")}</span>
            </div>
          )}
          {last && (
            <p className="text-sm" role="status" data-testid="offline-result">
              {t("result", {
                matched: last.matched,
                review: last.review,
                duplicates: last.duplicates,
                rejected: last.rejected.length,
              })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("reviewTitle", { count: rows.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {review.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState icon={ReceiptText} title={t("reviewEmpty")} />
          ) : (
            <ul className="grid gap-3">
              {rows.map((r) => (
                <ReviewRow key={r.id} clientId={clientId} sale={r} timeZone={timeZone} canUpdate={canUpdate} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {matched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("matchedTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {matched.map((r) => (
                <li key={r.id}>
                  <SaleLine sale={r} timeZone={timeZone}>
                    {r.lead_id && (
                      <Link href={`/leads/${r.lead_id}`} className="text-primary text-sm font-medium hover:underline">
                        {t("openLead")}
                      </Link>
                    )}
                    <Badge tone={r.automatic ? "info" : "success"}>{r.automatic ? t("auto") : t("confirmed")}</Badge>
                  </SaleLine>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SaleLine({ sale, timeZone, children }: { sale: OfflineSale; timeZone: string; children?: React.ReactNode }) {
  const f = useFormat();
  return (
    <div className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
      <span className="font-semibold tabular-nums">
        {f.money({ amount_minor: sale.amount_minor, currency: sale.currency })}
      </span>
      <span className="text-muted">{sale.external_ref}</span>
      {sale.customer_name && <span>{sale.customer_name}</span>}
      {sale.contact_hint && (
        <span className="text-muted" dir="ltr">
          {sale.contact_hint}
        </span>
      )}
      <span className="text-muted ms-auto text-xs">{f.dateTime(sale.sold_at, timeZone, "date")}</span>
      {children}
    </div>
  );
}

function ReviewRow({
  clientId,
  sale,
  timeZone,
  canUpdate,
}: {
  clientId: string;
  sale: OfflineSale;
  timeZone: string;
  canUpdate: boolean;
}) {
  const t = useTranslations("revintel.offline");
  const f = useFormat();
  const resolve = useResolveOffline(clientId);
  const reason = sale.match_reason ?? "no_match";
  return (
    <li className="grid gap-2" data-offline-sale={sale.id}>
      <SaleLine sale={sale} timeZone={timeZone}>
        <Badge tone="warning">{t(`reason.${reason}`)}</Badge>
      </SaleLine>
      {(sale.suggestions ?? []).length > 0 && (
        <ul className="grid gap-1.5 ps-3">
          {(sale.suggestions ?? []).map((s) => (
            <li key={s.lead_id} className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/leads/${s.lead_id}`} className="text-primary font-medium hover:underline">
                {s.full_name || t("unnamed")}
              </Link>
              <StageBadge stage={s.stage as "new"} />
              <span className="text-muted text-xs">
                {t("enquired", { when: f.dateTime(s.received_at, timeZone, "date") })} ·{" "}
                {[s.phone && t("samePhone"), s.email && t("sameEmail")].filter(Boolean).join(", ")}
              </span>
              {canUpdate && (
                <Button
                  size="sm"
                  className="ms-auto"
                  loading={resolve.isPending && resolve.variables?.leadId === s.lead_id}
                  onClick={() =>
                    resolve.mutate(
                      { id: sale.id, leadId: s.lead_id },
                      { onSuccess: () => toast.success(t("matchedToast")) },
                    )
                  }
                >
                  {t("thisLead")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpdate && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            loading={resolve.isPending && !resolve.variables?.leadId}
            onClick={() => resolve.mutate({ id: sale.id }, { onSuccess: () => toast.success(t("ignoredToast")) })}
          >
            {t("ignore")}
          </Button>
        </div>
      )}
    </li>
  );
}
