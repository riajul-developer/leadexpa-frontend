"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Copy,
  Lightbulb,
  MessageCircle,
  NotebookPen,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { LOCALE_NAMES, LOCALES, SPEECH_LANG, toApiLocale, type AppLocale } from "@/shared/config/locales";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { isApiError } from "@/shared/lib/api/errors";
import { whatsappHref } from "@/shared/lib/format";
import { sessionStore, editDistance } from "@/shared/lib/text";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { NativeSelect, Textarea } from "@/shared/ui/input";
import { Badge, Card, Skeleton } from "@/shared/ui/primitives";

type Lead = Schemas["Lead"];
type Channel = "whatsapp" | "sms" | "email" | "call_script";
type Language = "en" | "bn" | "banglish" | "ar";
type Tone = "friendly" | "formal" | "short";
type Stage = Schemas["Stage"];

interface DraftState {
  generationId: string;
  variants: { original: string; text: string }[];
  channel: Channel;
}

const sendFeedback = (generationId: string, outcome: "used" | "edited" | "discarded", edit?: number) =>
  unwrapEmpty(
    api.POST("/v1/assistant/generations/{generationId}/feedback", {
      params: { path: { generationId } },
      body: { outcome, edit_distance: edit },
    }),
  ).catch(() => undefined); // feedback is best effort

/** Templates used when AI is unavailable or disabled (FRONTEND_PROMPT §6 graceful fallback). */
function templates(t: ReturnType<typeof useTranslations>, name: string) {
  return [t("template.greeting", { name }), t("template.followUp", { name }), t("template.callback", { name })];
}

export function AiPanel({
  lead,
  onApplyStage,
  onUseAsNote,
}: {
  lead: Lead;
  onApplyStage?: (s: Stage) => void;
  onUseAsNote?: (text: string) => void;
}) {
  const t = useTranslations("ai");
  const storageKey = `recov-ai-draft:${lead.id}`;
  const [channel, setChannel] = useState<Channel>("whatsapp");
  // Drafts default to the UI language; the agent switches to the lead's language when it differs.
  const [language, setLanguage] = useState<Language>(toApiLocale(useLocale()));
  const [tone, setTone] = useState<Tone>("friendly");
  const [draft, setDraft] = useState<DraftState | null>(() => sessionStore.get<DraftState>(storageKey));
  const [fallback, setFallback] = useState<string | null>(null);

  // Unsent edits survive a phone call interrupting the page.
  useEffect(() => {
    if (draft) sessionStore.set(storageKey, draft);
    else sessionStore.remove(storageKey);
  }, [draft, storageKey]);

  const usage = useQuery({
    queryKey: ["assistant", "usage"],
    queryFn: () => unwrap(api.GET("/v1/assistant/usage")),
    staleTime: 5 * 60_000,
    meta: { silent: true },
  });
  const nearQuota =
    usage.data && usage.data.generation_quota > 0 && usage.data.generations / usage.data.generation_quota >= 0.8;

  const generate = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/leads/{leadId}/assistant/draft", {
          params: { path: { leadId: lead.id } },
          body: { channel, language, tone },
        }),
      ),
    meta: { silent: true },
    onSuccess: (r) => {
      // Generating again discards the previous, unused variants.
      if (draft) void sendFeedback(draft.generationId, "discarded");
      setFallback(null);
      setDraft({
        generationId: r.generation_id,
        channel,
        variants: r.variants.map((v) => ({ original: v.text, text: v.text })),
      });
      track("ai.draft.generated", { channel, language, tone, variants: r.variants.length });
      void usage.refetch();
    },
    onError: (e) => {
      if (isApiError(e) && e.isPlanLimit) return; // global upgrade dialog
      const code = isApiError(e) ? e.code : "ai_unavailable";
      setFallback(code === "ai_disabled" ? t("disabled") : code === "ai_refused" ? t("refused") : t("unavailable"));
    },
  });

  const applyVariant = (i: number, how: "copy" | "whatsapp" | "note") => {
    if (!draft) return;
    const v = draft.variants[i]!;
    const edited = v.text !== v.original;
    void sendFeedback(
      draft.generationId,
      edited ? "edited" : "used",
      edited ? editDistance(v.original, v.text) : undefined,
    );
    track(edited ? "ai.draft.edited" : "ai.draft.used", { how, channel: draft.channel });
    if (how === "copy") {
      void navigator.clipboard.writeText(v.text).then(() => toast.success(t("copied")));
    } else if (how === "whatsapp" && lead.phone) {
      window.open(whatsappHref(lead.phone.e164, v.text), "_blank", "noopener,noreferrer");
    } else if (how === "note") {
      onUseAsNote?.(v.text);
    }
    setDraft(null);
  };

  const discard = () => {
    if (draft) {
      void sendFeedback(draft.generationId, "discarded");
      track("ai.draft.discarded");
    }
    setDraft(null);
  };

  return (
    <div className="grid gap-4 p-4">
      <p className="bg-primary-soft text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
        <Sparkles className="size-3.5 shrink-0" aria-hidden />
        {t("label")}
      </p>
      <NextBestAction leadId={lead.id} />

      <section className="grid gap-3" aria-labelledby="ai-draft-h">
        <h3 id="ai-draft-h" className="text-sm font-semibold">
          {t("draftTitle")}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <NativeSelect
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            aria-label={t("channel")}
          >
            {(["whatsapp", "sms", "email", "call_script"] as const).map((c) => (
              <option key={c} value={c}>
                {t(`channels.${c}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label={t("language")}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
            <option value="banglish">Banglish</option>
          </NativeSelect>
          <NativeSelect value={tone} onChange={(e) => setTone(e.target.value as Tone)} aria-label={t("tone")}>
            {(["friendly", "formal", "short"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`tones.${x}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={() => generate.mutate()} loading={generate.isPending}>
          <Wand2 aria-hidden />
          {draft ? t("regenerate") : t("generate")}
        </Button>
        {nearQuota && usage.data && (
          <p className="text-warning text-xs">
            {t("quota", { used: usage.data.generations, max: usage.data.generation_quota })}
          </p>
        )}
        {generate.isPending && (
          <div className="grid gap-2" aria-live="polite">
            <p className="text-muted text-xs">{t("writing")}</p>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {fallback && (
          <div className="grid gap-2">
            <p role="status" className="text-muted text-sm">
              {fallback}
            </p>
            {templates(t, lead.full_name || "").map((text) => (
              <Card key={text} className="grid gap-2 p-3">
                <p className="text-sm whitespace-pre-wrap">{text}</p>
                {lead.phone && (
                  <Button size="sm" variant="secondary" asChild>
                    <a href={whatsappHref(lead.phone.e164, text)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="text-success" aria-hidden />
                      {t("openWhatsapp")}
                    </a>
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
        {draft && !generate.isPending && (
          <div className="grid gap-3">
            {draft.variants.map((v, i) => (
              <Card key={i} className="grid gap-2 p-3">
                <div className="flex items-center justify-between">
                  <Badge tone="primary">
                    <Sparkles aria-hidden />
                    {t("variant", { n: i + 1 })}
                  </Badge>
                  {v.text !== v.original && <span className="text-muted text-xs">{t("edited")}</span>}
                </div>
                {/* Plain text only: AI output is never rendered as HTML. */}
                <Textarea
                  rows={4}
                  value={v.text}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variants: draft.variants.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                    })
                  }
                  aria-label={t("variant", { n: i + 1 })}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => applyVariant(i, "copy")}>
                    <Copy aria-hidden />
                    {t("copy")}
                  </Button>
                  {lead.phone && draft.channel === "whatsapp" && (
                    <Button size="sm" variant="secondary" onClick={() => applyVariant(i, "whatsapp")}>
                      <MessageCircle className="text-success" aria-hidden />
                      {t("openWhatsapp")}
                    </Button>
                  )}
                  {onUseAsNote && (
                    <Button size="sm" variant="ghost" onClick={() => applyVariant(i, "note")}>
                      <NotebookPen aria-hidden />
                      {t("useAsNote")}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            <div className="flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={discard}>
                {t("discard")}
              </Button>
              <span className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("thumbsUp")}
                  onClick={() => track("ai.draft.rated", { up: true })}
                >
                  <ThumbsUp aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("thumbsDown")}
                  onClick={() => track("ai.draft.rated", { up: false })}
                >
                  <ThumbsDown aria-hidden />
                </Button>
              </span>
            </div>
          </div>
        )}
      </section>

      <Summarize leadId={lead.id} currentStage={lead.stage} onApplyStage={onApplyStage} />
    </div>
  );
}

function NextBestAction({ leadId }: { leadId: string }) {
  const t = useTranslations("ai.nba");
  const q = useQuery({
    queryKey: ["leads", "next-action", leadId],
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/assistant/next-action", { params: { path: { leadId } } })),
    staleTime: 60_000,
    meta: { silent: true },
  });
  if (!q.data || q.data.action === "none") return null;
  return (
    <details className="group border-border rounded-lg border p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
        <Lightbulb className="text-warning size-4" aria-hidden />
        <span className="flex-1">{t(`action.${q.data.action}`)}</span>
        <span className="text-muted flex items-center gap-1 text-xs">
          {t("why")}
          <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <p className="text-muted mt-2 text-sm">{q.data.reason}</p>
    </details>
  );
}

function Summarize({
  leadId,
  currentStage,
  onApplyStage,
}: {
  leadId: string;
  currentStage: Stage;
  onApplyStage?: (s: Stage) => void;
}) {
  const t = useTranslations("ai.summary");
  const ts = useTranslations("stage");
  const [notes, setNotes] = useState("");
  const [listening, setListening] = useState(false);
  const recognition = useRef<{ stop: () => void } | null>(null);
  const summarize = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/v1/leads/{leadId}/assistant/summary", { params: { path: { leadId } }, body: { notes } })),
    meta: { silent: true },
    onSuccess: () => track("ai.summary.generated"),
    onError: (e) => {
      if (!(isApiError(e) && e.isPlanLimit)) toast.error(t("failed"));
    },
  });
  const s = summarize.data;
  const SpeechRecognition =
    typeof window !== "undefined"
      ? ((
          window as unknown as {
            SpeechRecognition?: new () => SpeechLike;
            webkitSpeechRecognition?: new () => SpeechLike;
          }
        ).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechLike }).webkitSpeechRecognition)
      : undefined;

  const dictate = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new SpeechRecognition();
    r.lang = SPEECH_LANG[document.documentElement.lang as AppLocale] ?? navigator.language;
    r.interimResults = false;
    r.onresult = (e) =>
      setNotes(
        (n) =>
          (n ? n + " " : "") +
          Array.from(e.results)
            .map((x) => x[0]?.transcript ?? "")
            .join(" "),
      );
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  return (
    <section className="grid gap-3" aria-labelledby="ai-sum-h">
      <h3 id="ai-sum-h" className="text-sm font-semibold">
        {t("title")}
      </h3>
      <Textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("title")}
        maxLength={8000}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => summarize.mutate()}
          disabled={notes.trim().length < 10}
          loading={summarize.isPending}
        >
          {t("cta")}
        </Button>
        {SpeechRecognition && (
          <Button variant="ghost" onClick={dictate} aria-pressed={listening}>
            {listening ? t("stop") : t("dictate")}
          </Button>
        )}
      </div>
      {s && (
        <Card className="grid gap-2 p-3 text-sm">
          <p>{s.summary}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">{t("intent")}</dt>
            <dd>{t(`intents.${s.intent}`)}</dd>
            {s.budget && (
              <>
                <dt className="text-muted">{t("budget")}</dt>
                <dd>{s.budget}</dd>
              </>
            )}
            {s.timeline && (
              <>
                <dt className="text-muted">{t("timeline")}</dt>
                <dd>{s.timeline}</dd>
              </>
            )}
            {s.objections.length > 0 && (
              <>
                <dt className="text-muted">{t("objections")}</dt>
                <dd>{s.objections.join(" · ")}</dd>
              </>
            )}
            {s.next_step && (
              <>
                <dt className="text-muted">{t("nextStep")}</dt>
                <dd>{s.next_step}</dd>
              </>
            )}
          </dl>
          {s.suggested_stage !== "unchanged" && s.suggested_stage !== currentStage && onApplyStage && (
            <Button size="sm" variant="secondary" onClick={() => onApplyStage(s.suggested_stage as Stage)}>
              {t("apply", { stage: ts(s.suggested_stage) })}
            </Button>
          )}
        </Card>
      )}
    </section>
  );
}

interface SpeechLike {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
