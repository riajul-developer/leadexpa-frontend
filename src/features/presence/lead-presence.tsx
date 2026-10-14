"use client";

import { PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { api, type Schemas } from "@/shared/lib/api/client";
import { realtime } from "@/shared/lib/realtime";
import { useMe } from "@/shared/lib/session";
import { Avatar } from "@/shared/ui/primitives";

type Viewer = Schemas["PresenceView"]["viewers"][number];
type State = "viewing" | "editing";

const BEAT_MS = 20_000;

/** Focus inside a [data-lead-edit] area (the note composer) means "editing". */
function useEditing(): State {
  const [state, setState] = useState<State>("viewing");
  useEffect(() => {
    const check = () => setState(document.activeElement?.closest("[data-lead-edit]") ? "editing" : "viewing");
    const onOut = () => setTimeout(check, 0); // after focus has moved
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return state;
}

/**
 * Real-time presence (Tier 3, 8h): teammates on the same lead, and a soft lock — a note when someone else is
 * writing, never a block. Heartbeats every 20 s while the tab is visible; changes arrive over the stream.
 * Loaded lazily from the lead header so it adds nothing to first load.
 */
export default function LeadPresence({ leadId }: { leadId: string }) {
  const t = useTranslations("presence");
  const { data: me } = useMe();
  const resource = `lead:${leadId}`;
  const state = useEditing();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let live = true;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void api
        .POST("/v1/presence", { body: { resource, state: stateRef.current } })
        .then(({ data }) => live && data && setViewers(data.viewers))
        .catch(() => undefined); // presence is best-effort
    };
    const leave = () => void api.POST("/v1/presence/leave", { body: { resource } }).catch(() => undefined);
    const onVisibility = () => (document.visibilityState === "visible" ? beat() : leave());
    beat();
    const timer = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    const off = realtime.subscribe((e) => {
      if (e.type === "presence.changed" && e.data.resource === resource)
        setViewers((e.data.viewers as Viewer[] | undefined) ?? []);
    });
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      off();
      leave();
    };
  }, [resource]);

  // Tell the others at once when I start or stop writing.
  useEffect(() => {
    void api
      .POST("/v1/presence", { body: { resource, state } })
      .then(({ data }) => data && setViewers(data.viewers))
      .catch(() => undefined);
  }, [resource, state]);

  const others = viewers.filter((v) => v.user_id !== me?.user.id);
  if (others.length === 0) return null;
  const editor = others.find((v) => v.state === "editing");
  const shown = others.slice(0, 4);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="lead-presence">
      <div className="flex items-center" role="group" aria-label={t("here", { count: others.length })}>
        {shown.map((v) => (
          <span key={v.user_id} className="-ms-1.5 first:ms-0">
            <Avatar name={v.name} size="sm" className="ring-surface ring-2" />
            <span className="sr-only">{v.name}</span>
          </span>
        ))}
        {others.length > shown.length && (
          <span className="text-muted ms-1 text-xs">+{others.length - shown.length}</span>
        )}
      </div>
      <span className="text-muted text-xs">
        {others.length === 1 ? t("alsoHere", { name: others[0]!.name }) : t("here", { count: others.length })}
      </span>
      {editor && (
        <p
          role="status"
          className="bg-warning-soft text-warning flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs"
        >
          <PencilLine aria-hidden className="size-3.5" />
          {t("editing", { name: editor.name })}
        </p>
      )}
    </div>
  );
}
