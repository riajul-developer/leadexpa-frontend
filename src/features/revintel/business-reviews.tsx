"use client";

import { CheckCircle2, FileText, Link2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type BusinessReview,
  type ReviewContent,
  type ReviewFact,
  useBusinessReviews,
  useGenerateReview,
  useReviewActions,
} from "./audit-api";
import { FactText, useFactFormatter } from "./facts";

const LANGUAGES = ["en", "bn", "ar"] as const;

export function ReviewDocument({ review }: { review: BusinessReview }) {
  const t = useTranslations("revintel.review");
  const c = review.content;
  return (
    <article
      className="grid gap-4"
      lang={review.language}
      dir={review.language === "ar" ? "rtl" : undefined}
      data-testid="review-document"
    >
      <h2 className="text-xl font-semibold">
        <FactText text={c.headline} facts={review.facts} />
      </h2>
      {c.sections.map((s, i) => (
        <section key={i} className="grid gap-1">
          <h3 className="font-semibold">
            <FactText text={s.title} facts={review.facts} />
          </h3>
          <p className="text-sm leading-relaxed">
            <FactText text={s.body} facts={review.facts} />
          </p>
        </section>
      ))}
      {c.recommendations.length > 0 && (
        <section className="grid gap-1">
          <h3 className="font-semibold">{t("recommendations")}</h3>
          <ul className="grid list-disc gap-1 ps-5 text-sm">
            {c.recommendations.map((r, i) => (
              <li key={i}>
                <FactText text={r} facts={review.facts} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export function ClientBusinessReviews({ clientId }: { clientId: string }) {
  const t = useTranslations("revintel.review");
  const te = useTranslations("errors");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const locale = useLocale();
  const canShare = useCan("report.share");
  const list = useBusinessReviews(clientId);
  const generate = useGenerateReview(clientId);
  const [kind, setKind] = useState<"monthly" | "quarterly">("monthly");
  const [language, setLanguage] = useState<string>(LANGUAGES.includes(locale as never) ? locale : "en");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = list.data?.data ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="text-accent size-5" aria-hidden />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted text-sm">{t("hint")}</p>
          {canShare && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("kind")}>
                <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  <option value="monthly">{t("monthly")}</option>
                  <option value="quarterly">{t("quarterly")}</option>
                </NativeSelect>
              </Field>
              <Field label={t("language")}>
                <NativeSelect value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {t(`languages.${l}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                loading={generate.isPending}
                onClick={() =>
                  generate.mutate(
                    { kind, language },
                    {
                      onSuccess: (r) => setOpenId(r.id),
                      onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed")),
                    },
                  )
                }
              >
                <Sparkles aria-hidden />
                {t("generate")}
              </Button>
            </div>
          )}
          {list.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState icon={FileText} title={t("empty")} />
          ) : (
            <ul className="grid gap-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    aria-current={r.id === openId ? "true" : undefined}
                    className="border-border hover:bg-surface-2 aria-[current=true]:border-primary flex w-full flex-wrap items-center gap-2 rounded-lg border p-2.5 text-start text-sm"
                  >
                    <span className="font-medium">{t(r.kind)}</span>
                    <span className="text-muted">
                      {f.dateTime(r.period_from + "T12:00:00Z", "UTC", "date")} –{" "}
                      {f.dateTime(r.period_to + "T12:00:00Z", "UTC", "date")}
                    </span>
                    <Badge tone={r.status === "approved" ? "success" : "warning"}>{t(`status.${r.status}`)}</Badge>
                    {r.shared && <Badge tone="info">{t("shared")}</Badge>}
                    <span className="text-muted ms-auto text-xs">{f.dateTime(r.created_at, tz, "short")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {open && (
        <ReviewEditor
          key={open.id + open.status + String(open.edited)}
          clientId={clientId}
          review={open}
          canShare={canShare}
        />
      )}
    </div>
  );
}

function ReviewEditor({ clientId, review, canShare }: { clientId: string; review: BusinessReview; canShare: boolean }) {
  const t = useTranslations("revintel.review");
  const te = useTranslations("errors");
  const fmt = useFactFormatter();
  const { save, approve, share } = useReviewActions(clientId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReviewContent>(review.content);
  const [problems, setProblems] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("sections.0.body");
  const numbers = review.facts.filter((f) => f.kind !== "text" || f.label);

  const insert = (fact: ReviewFact) => {
    const token = `{{${fact.key}}}`;
    setDraft((d) => {
      const c = structuredClone(d);
      const [part, idx, field] = target.split(".");
      if (part === "headline") c.headline += ` ${token}`;
      else if (part === "sections") {
        const s = c.sections[Number(idx)]!;
        s[field as "title" | "body"] += ` ${token}`;
      } else c.recommendations[Number(idx)] += ` ${token}`;
      return c;
    });
  };
  const onSave = () =>
    save.mutate(
      { id: review.id, content: draft },
      {
        onSuccess: () => {
          setEditing(false);
          setProblems([]);
          toast.success(t("saved"));
        },
        onError: (e) => {
          const fields = isApiError(e) ? Object.entries(e.fieldErrors) : [];
          if (fields.length) setProblems(fields.map(([field, x]) => (x.code === "literal_number" ? x.message : field)));
          else toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : t("failed"));
        },
      },
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(review.kind)}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {canShare && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {t("edit")}
            </Button>
          )}
          {canShare && review.status === "draft" && !editing && (
            <Button
              size="sm"
              loading={approve.isPending}
              onClick={() => approve.mutate(review.id, { onSuccess: () => toast.success(t("approvedToast")) })}
            >
              <CheckCircle2 aria-hidden />
              {t("approve")}
            </Button>
          )}
          {canShare && review.status === "approved" && (
            <Button
              size="sm"
              variant="secondary"
              loading={share.isPending}
              onClick={() => share.mutate(review.id, { onSuccess: ({ url }) => setLink(url) })}
            >
              <Link2 aria-hidden />
              {t("share")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {link && (
          <p className="bg-surface-2 rounded-lg p-3 text-sm" role="status">
            {t("shareReady")}{" "}
            <span dir="ltr" className="font-mono text-xs break-all">
              {link}
            </span>
          </p>
        )}
        {!editing ? (
          <>
            <p className="text-muted text-xs">{t("numbersHint")}</p>
            <ReviewDocument review={review} />
          </>
        ) : (
          <div className="grid gap-3" data-testid="review-editor">
            <p className="text-muted text-xs">{t("editHint")}</p>
            <Field label={t("headline")}>
              <Input
                value={draft.headline}
                onFocus={() => setTarget("headline")}
                onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              />
            </Field>
            {draft.sections.map((s, i) => (
              <div key={i} className="grid gap-2">
                <Field label={t("sectionTitle", { n: i + 1 })}>
                  <Input
                    value={s.title}
                    onFocus={() => setTarget(`sections.${i}.title`)}
                    onChange={(e) => {
                      const sections = [...draft.sections];
                      sections[i] = { ...s, title: e.target.value };
                      setDraft({ ...draft, sections });
                    }}
                  />
                </Field>
                <Field label={t("sectionBody", { n: i + 1 })}>
                  <Textarea
                    rows={4}
                    value={s.body}
                    onFocus={() => setTarget(`sections.${i}.body`)}
                    onChange={(e) => {
                      const sections = [...draft.sections];
                      sections[i] = { ...s, body: e.target.value };
                      setDraft({ ...draft, sections });
                    }}
                  />
                </Field>
              </div>
            ))}
            {draft.recommendations.map((r, i) => (
              <Field key={i} label={t("recommendation", { n: i + 1 })}>
                <Input
                  value={r}
                  onFocus={() => setTarget(`recommendations.${i}`)}
                  onChange={(e) => {
                    const recommendations = [...draft.recommendations];
                    recommendations[i] = e.target.value;
                    setDraft({ ...draft, recommendations });
                  }}
                />
              </Field>
            ))}
            <Field label={t("insert")} hint={t("insertHint")}>
              <NativeSelect
                value=""
                onChange={(e) => {
                  const fact = numbers.find((x) => x.key === e.target.value);
                  if (fact) insert(fact);
                }}
              >
                <option value="">{t("insertPick")}</option>
                {numbers.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.key} = {fmt(x)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {problems.length > 0 && (
              <ul role="alert" className="text-danger grid list-disc gap-0.5 ps-5 text-sm">
                {problems.map((p, i) => (
                  <li key={i}>{t("problem", { text: p })}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => (setEditing(false), setDraft(review.content), setProblems([]))}
              >
                {t("cancel")}
              </Button>
              <Button loading={save.isPending} onClick={onSave}>
                {t("save")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
