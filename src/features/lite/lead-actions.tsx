"use client";

import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { lite, telHref, whatsappHref, type Schemas } from "./api";

type Channel = "call" | "whatsapp";
type Outcome = "connected" | "no_answer" | "busy" | "wrong_number" | "interested" | "not_interested" | "message_sent";

const OUTCOMES: Record<Channel, Outcome[]> = {
  call: ["connected", "interested", "not_interested", "no_answer", "busy", "wrong_number"],
  whatsapp: ["message_sent", "interested", "not_interested", "wrong_number"],
};

const big = "flex min-h-12 items-center justify-center gap-2 rounded-lg text-base font-medium";

export function LeadActions({ lead, onLogged }: { lead: Schemas["Lead"]; onLogged: () => void }) {
  const t = useTranslations("lite");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  if (lead.do_not_contact)
    return <p className="bg-danger-soft text-danger rounded-lg p-3 text-sm">{t("doNotContact")}</p>;
  if (!lead.phone) return null;

  const log = async (outcome: Outcome) => {
    if (!channel) return;
    setSaving(true);
    setFailed(false);
    try {
      await lite("POST", `/v1/leads/${lead.id}/activities`, { type: channel, outcome });
      setChannel(null);
      setSaved(true);
      onLogged();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <a
          className={`${big} bg-primary text-primary-fg`}
          href={telHref(lead.phone.e164)}
          onClick={() => setChannel("call")}
        >
          <Phone className="size-5" aria-hidden />
          {t("call")}
        </a>
        <a
          className={`${big} border-border border`}
          href={whatsappHref(lead.phone.e164)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setChannel("whatsapp")}
        >
          <MessageCircle className="size-5" aria-hidden />
          {t("whatsapp")}
        </a>
      </div>
      {saved && !channel && (
        <p role="status" className="text-success flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("saved")}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-danger text-sm">
          {t("saveFailed")}
        </p>
      )}
      {channel ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">{t("whatHappened")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES[channel].map((o) => (
              <button
                key={o}
                type="button"
                disabled={saving}
                className="border-border min-h-12 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                onClick={() => void log(o)}
              >
                {t(`outcome.${o}`)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(["call", "whatsapp"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="text-primary min-h-12 px-1 text-sm font-medium"
              onClick={() => setChannel(c)}
            >
              {t(c === "call" ? "loggedCall" : "loggedWhatsApp")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
