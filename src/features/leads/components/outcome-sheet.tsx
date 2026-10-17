"use client";

import { addDays, setHours, setMinutes } from "date-fns";
import {
  CalendarClock,
  PhoneOff,
  PhoneMissed,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  UserX,
  Check,
  MessageCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Input, Textarea } from "@/shared/ui/input";
import { Sheet, SheetContent } from "@/shared/ui/overlays";

import { useLogActivity, type Lead, type Outcome } from "../api/hooks";

import type { Channel } from "./contact-flow";

const OUTCOMES: { value: Outcome; icon: typeof Check; tone: string }[] = [
  { value: "connected", icon: Check, tone: "text-success" },
  { value: "no_answer", icon: PhoneMissed, tone: "text-muted" },
  { value: "busy", icon: PhoneOff, tone: "text-muted" },
  { value: "callback_requested", icon: CalendarClock, tone: "text-info" },
  { value: "interested", icon: ThumbsUp, tone: "text-success" },
  { value: "not_interested", icon: ThumbsDown, tone: "text-muted" },
  { value: "wrong_number", icon: UserX, tone: "text-danger" },
  { value: "fake_or_junk", icon: ShieldAlert, tone: "text-danger" },
];

/** datetime-local value for "today 3 hours from now, rounded to 15 min" or "tomorrow 10:00". */
function presets(now = new Date()) {
  const later = new Date(Math.ceil((now.getTime() + 3 * 3600_000) / 900_000) * 900_000);
  const tomorrow = setMinutes(setHours(addDays(now, 1), 10), 0);
  return { later, tomorrow };
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * One tap logs the outcome (FRONTEND_PROMPT §5.2). Only "callback requested" asks for a time; the note is
 * optional. The SLA chip turns "met" immediately (optimistic).
 */
export function OutcomeSheet({
  lead,
  channel,
  onClose,
}: {
  lead: Pick<Lead, "id" | "full_name" | "received_at" | "first_response_at" | "stage">;
  channel: Channel;
  onClose: () => void;
}) {
  const t = useTranslations("outcome");
  const log = useLogActivity(lead);
  const [note, setNote] = useState("");
  const [callback, setCallback] = useState<string | null>(null);
  const p = presets();

  const submit = (outcome: Outcome, callbackAt?: string) => {
    log.mutate({
      type: channel,
      outcome,
      body: note.trim() || undefined,
      callback_at: callbackAt,
    });
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={t("title", { name: lead.full_name || "—" })}
        side="center"
      >
        <div className="grid gap-4 p-4">
          {callback === null ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {channel === "whatsapp" && (
                  <Button
                    variant="secondary"
                    size="lg"
                    className="h-auto min-h-12 justify-start py-2 text-start whitespace-normal"
                    onClick={() => submit("message_sent")}
                  >
                    <MessageCircle className="text-success" aria-hidden />
                    {t("message_sent")}
                  </Button>
                )}
                {OUTCOMES.map(({ value, icon: Icon, tone }) => (
                  <Button
                    key={value}
                    variant="secondary"
                    size="lg"
                    className="h-auto min-h-12 justify-start py-2 text-start whitespace-normal"
                    onClick={() =>
                      value === "callback_requested" ? setCallback(toLocalInput(p.later)) : submit(value)
                    }
                  >
                    <Icon className={tone} aria-hidden />
                    {t(value)}
                  </Button>
                ))}
              </div>
              <Textarea
                rows={2}
                placeholder={t("notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label={t("note")}
              />
            </>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm font-medium">{t("whenCallback")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCallback(toLocalInput(p.later))}>
                  {t("in3h")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setCallback(toLocalInput(p.tomorrow))}>
                  {t("tomorrow10")}
                </Button>
              </div>
              <Input
                type="datetime-local"
                value={callback}
                min={toLocalInput(new Date())}
                onChange={(e) => setCallback(e.target.value)}
                aria-label={t("whenCallback")}
              />
              <Textarea
                rows={2}
                placeholder={t("notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label={t("note")}
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setCallback(null)}>
                  {t("back")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!callback}
                  onClick={() => callback && submit("callback_requested", new Date(callback).toISOString())}
                >
                  {t("saveCallback")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
