"use client";

import { ArrowLeft, PhoneCall, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { cn } from "@/shared/lib/cn";
import { useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { EmptyState, Skeleton } from "@/shared/ui/primitives";

import { recordingUrl, useCall, type Turn } from "./api";
import { CallStatusBadge } from "./status";

const SummaryCard = dynamic(() => import("./summary-card").then((m) => m.SummaryCard));

export function CallDetail({ callId, onBack }: { callId: string; onBack?: () => void }) {
  const t = useTranslations("calls");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const { byUserId } = useMembers();
  const q = useCall(callId);
  const audio = useRef<HTMLAudioElement>(null);
  if (q.isPending) return <Skeleton className="m-4 h-64" />;
  if (!q.data) return <EmptyState title={t("notFound")} />;
  const c = q.data;
  const agent = c.agent_user_id ? byUserId.get(c.agent_user_id)?.user.name : undefined;
  const seek = (s: number) => {
    if (!audio.current) return;
    audio.current.currentTime = s;
    void audio.current.play().catch(() => undefined);
  };
  return (
    <article
      className="flex min-h-full flex-col gap-4 p-4"
      aria-label={t("detailLabel", { name: c.lead_name || f.phone(c.to) })}
    >
      <header className="flex flex-wrap items-start gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack} aria-label={t("back")}>
            <ArrowLeft aria-hidden className="rtl:rotate-180" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">
            <Link href={`/leads/${c.lead_id}`} className="hover:underline">
              {c.lead_name || f.phone(c.direction === "inbound" ? c.from : c.to)}
            </Link>
          </h2>
          <p className="text-muted text-sm">
            {t(`direction.${c.direction}`)} · {f.dateTime(c.started_at, tz)}
            {c.duration_seconds > 0 && ` · ${f.duration(c.duration_seconds)}`}
            {agent && ` · ${agent}`}
          </p>
        </div>
        <CallStatusBadge status={c.status} />
      </header>

      {c.recording_status === "stored" && (
        <audio ref={audio} controls preload="none" src={recordingUrl(c.id)} className="w-full">
          <track kind="captions" />
        </audio>
      )}
      {c.recording_status !== "stored" && c.recording_status !== "none" && (
        <p className="text-muted text-sm">{t(`recording.${c.recording_status}`)}</p>
      )}

      {c.summary && <SummaryCard c={c} s={c.summary} />}

      {c.transcript_status === "pending" && <Skeleton className="h-24" />}
      {c.transcript_status === "failed" && <p className="text-muted text-sm">{t("transcriptFailed")}</p>}
      {c.transcript.length > 0 && (
        <Transcript turns={c.transcript} onSeek={seek} canSeek={c.recording_status === "stored"} />
      )}

      {/* Nothing recorded or transcribed: say so in the middle of the pane rather than leaving it blank. */}
      {c.recording_status === "none" &&
        !c.summary &&
        c.transcript_status !== "pending" &&
        c.transcript_status !== "failed" &&
        c.transcript.length === 0 && (
          <EmptyState icon={PhoneCall} title={t("noDetail")} description={t("noDetailHint")} className="flex-1" />
        )}
    </article>
  );
}

function Transcript({ turns, onSeek, canSeek }: { turns: Turn[]; onSeek: (s: number) => void; canSeek: boolean }) {
  const t = useTranslations("calls");
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase();
  const shown = useMemo(
    () => (needle ? turns.filter((x) => x.text.toLocaleLowerCase().includes(needle)) : turns),
    [turns, needle],
  );
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <section aria-labelledby="transcript-h" className="grid gap-2">
      <div className="flex items-center gap-2">
        <h3 id="transcript-h" className="flex-1 font-semibold">
          {t("transcript")}
        </h3>
        <div className="relative w-48">
          <Search className="text-muted pointer-events-none absolute start-2 top-2.5 size-4" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchTranscript")}
            aria-label={t("searchTranscript")}
            className="ps-8"
          />
        </div>
      </div>
      {shown.length === 0 && <p className="text-muted text-sm">{t("noMatches")}</p>}
      <ol className="grid gap-1">
        {shown.map((x, i) => (
          <li key={`${x.start}-${i}`}>
            <button
              type="button"
              disabled={!canSeek}
              onClick={() => onSeek(x.start)}
              className="hover:bg-surface-2 flex w-full gap-3 rounded-lg px-2 py-1.5 text-start text-sm disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="text-muted w-10 shrink-0 tabular-nums" dir="ltr">
                {clock(x.start)}
              </span>
              {x.speaker && (
                <span className={cn("w-14 shrink-0 font-medium", x.speaker === "agent" ? "text-primary" : "")}>
                  {t(`speaker.${x.speaker === "agent" ? "agent" : "lead"}`)}
                </span>
              )}
              <span dir="auto">{x.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
