"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MailQuestion, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { toLatinDigits } from "@/shared/lib/format";
import { useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { leadKeys, reviewKeys } from "@/shared/lib/query-keys";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, Textarea } from "@/shared/ui/input";
import { Badge, Card, EmptyState, Skeleton } from "@/shared/ui/primitives";

type Item = Schemas["ReviewItem"];

export function ReviewQueue() {
  const t = useTranslations("review");
  const f = useFormat();
  const now = useNow();
  const { byId } = useClients();
  const q = useQuery({ queryKey: reviewKeys.list, queryFn: () => unwrap(api.GET("/v1/ingestion/review")) });
  const items = q.data?.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.id === selectedId) ?? items[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted text-sm">{t("hint")}</p>
      </div>
      {q.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !selected ? (
        <EmptyState icon={MailQuestion} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <ul className="grid content-start gap-2" aria-label={t("listLabel")}>
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(i.id)}
                  aria-current={i.id === selected.id ? "true" : undefined}
                  className={`border-border w-full rounded-lg border p-3 text-start text-sm ${
                    i.id === selected.id ? "bg-primary-soft border-primary" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="block truncate font-medium">{i.subject || t("noSubject")}</span>
                  <span className="text-muted block truncate text-xs">
                    {byId.get(i.client_id)?.name ?? "—"} · {f.relative(i.received_at, now || Date.now())}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <ReviewDetail key={selected.id} item={selected} onDone={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function ReviewDetail({ item, onDone }: { item: Item; onDone: () => void }) {
  const t = useTranslations("review");
  const te = useTranslations("errors");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const router = useRouter();
  const qc = useQueryClient();
  const [values, setValues] = useState({
    full_name: item.fields.full_name ?? "",
    phone: item.fields.phone ?? "",
    email: item.fields.email ?? "",
    message: item.fields.message ?? "",
  });
  useEffect(() => track("ingestion.review.opened", { parser: item.parser }), [item.parser]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: reviewKeys.all });
    onDone();
  };
  const accept = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/ingestion/review/{eventId}/accept", {
          params: { path: { eventId: item.id } },
          body: {
            full_name: values.full_name.trim(),
            phone: toLatinDigits(values.phone).trim(),
            email: values.email.trim(),
            message: values.message.trim(),
          },
        }),
      ),
    meta: { silent: true },
    onSuccess: (lead) => {
      track("ingestion.review.accepted", { parser: item.parser });
      void qc.invalidateQueries({ queryKey: leadKeys.lists() });
      toast.success(t("accepted"), {
        action: { label: t("openLead"), onClick: () => router.push(`/leads/${lead.id}`) },
      });
      refresh();
    },
    onError: () => toast.error(t("acceptFailed")),
  });
  const reject = useMutation({
    mutationFn: () =>
      unwrapEmpty(api.POST("/v1/ingestion/review/{eventId}/reject", { params: { path: { eventId: item.id } } })),
    onSuccess: () => {
      track("ingestion.review.rejected", { parser: item.parser });
      toast.success(t("rejected"));
      refresh();
    },
    onError: () => toast.error(te("internal")),
  });
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const extra = Object.entries(item.fields).filter(([k]) => !["full_name", "phone", "email", "message"].includes(k));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="grid content-start gap-2 p-4">
        <h2 className="font-semibold">{t("original")}</h2>
        <dl className="text-muted grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt>{t("from")}</dt>
          <dd className="truncate" dir="auto">
            {item.from}
          </dd>
          <dt>{t("subject")}</dt>
          <dd dir="auto">{item.subject || "—"}</dd>
          <dt>{t("received")}</dt>
          <dd>{f.dateTime(item.received_at, tz)}</dd>
        </dl>
        <pre
          dir="auto"
          className="bg-surface-2 max-h-[28rem] overflow-auto rounded-lg p-3 font-sans text-sm break-words whitespace-pre-wrap"
        >
          {item.body}
        </pre>
      </Card>
      <Card className="p-4">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-semibold">{t("extracted")}</h2>
            <Badge tone="warning">{t("confidence", { pct: Math.round(item.confidence * 100) })}</Badge>
          </div>
          <Field label={t("name")}>
            <Input value={values.full_name} onChange={set("full_name")} maxLength={200} />
          </Field>
          <Field label={t("phone")}>
            <Input value={values.phone} onChange={set("phone")} inputMode="tel" dir="ltr" maxLength={40} />
          </Field>
          <Field label={t("email")}>
            <Input value={values.email} onChange={set("email")} type="email" dir="ltr" maxLength={254} />
          </Field>
          <Field label={t("message")}>
            <Textarea value={values.message} onChange={set("message")} rows={3} maxLength={2000} />
          </Field>
          {extra.length > 0 && (
            <dl className="text-muted grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              {extra.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>{k}</dt>
                  <dd className="truncate">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => reject.mutate()} loading={reject.isPending}>
              <X aria-hidden />
              {t("reject")}
            </Button>
            <Button type="submit" loading={accept.isPending} disabled={!values.phone.trim() && !values.email.trim()}>
              <Check aria-hidden />
              {t("accept")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
