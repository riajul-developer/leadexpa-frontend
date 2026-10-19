"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Code2, Copy, Globe, KeyRound, Mail, Pause, Play, Plus, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { isRTL, LOCALE_NAMES, LOCALES, toApiLocale, type ApiLocale, type AppLocale } from "@/shared/config/locales";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { lookupKeys, useSources } from "@/shared/lib/lookups";
import { useCan } from "@/shared/lib/session";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { SourceBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, Textarea } from "@/shared/ui/input";
import { Dialog, DialogContent, Switch } from "@/shared/ui/overlays";
import { Badge, Card, EmptyState, Skeleton } from "@/shared/ui/primitives";

type Source = Schemas["Source"];

function appOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

// Pasted into the client's own website, so it uses the site's language, not the UI's.
const SNIPPET_COPY: Record<ApiLocale, { name: string; phone: string; consent: string; send: string }> = {
  en: { name: "Your name", phone: "Mobile number", consent: "I agree to be contacted on WhatsApp", send: "Send" },
  bn: { name: "আপনার নাম", phone: "মোবাইল নম্বর", consent: "WhatsApp-এ যোগাযোগে সম্মতি দিচ্ছি", send: "পাঠান" },
  ar: { name: "اسمك", phone: "رقم الجوال", consent: "أوافق على التواصل معي عبر واتساب", send: "إرسال" },
};

export function embedSnippets(endpoint: string, lang: AppLocale, otp = false) {
  const c = SNIPPET_COPY[toApiLocale(lang)];
  const dirAttr = isRTL(lang) ? ' dir="rtl"' : "";
  const otpAttr = otp ? ' data-recov-otp="1"' : "";
  const js = `<form data-recov-form="${endpoint}" data-recov-lang="${lang}"${otpAttr}${dirAttr}>
  <input name="name" placeholder="${c.name}" required>
  <input name="phone" type="tel" placeholder="${c.phone}" required>
  <label><input type="checkbox" name="consent" data-recov-consent> ${c.consent}</label>
  <button type="submit">${c.send}</button>
</form>
<script src="${appOrigin()}/embed/v1.js" async></script>`;
  const html = `<form method="post" action="${endpoint}"${dirAttr}>
  <input name="name" required>
  <input name="phone" type="tel" required>
  <input name="_hp" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">${c.send}</button>
</form>`;
  return { js, html };
}

export function SourcesPanel({ clientId }: { clientId: string }) {
  const t = useTranslations("sources");
  const f = useFormat();
  const now = useNow();
  const canManage = useCan("client.manage");
  const q = useSources(clientId);
  const [creating, setCreating] = useState(false);
  const [snippetFor, setSnippetFor] = useState<Source | null>(null);
  const [guideFor, setGuideFor] = useState<Source | null>(null);
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (s: Source) =>
      unwrap(
        api.PATCH("/v1/sources/{sourceId}", {
          params: { path: { sourceId: s.id } },
          body: { status: s.status === "active" ? "paused" : "active" },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.sources(clientId) }),
  });
  const addEmail = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/sources", {
          params: { path: { clientId } },
          body: { kind: "email_in", name: t("emailInDefaultName") },
        }),
      ),
    meta: { silent: true },
    onSuccess: (s) => {
      track("source.email_in.created");
      void qc.invalidateQueries({ queryKey: lookupKeys.sources(clientId) });
      setGuideFor(s);
    },
    onError: () => toast.error(t("emailInUnavailable")),
  });
  const otp = useMutation({
    mutationFn: ({ s, on }: { s: Source; on: boolean }) =>
      unwrap(api.PATCH("/v1/sources/{sourceId}", { params: { path: { sourceId: s.id } }, body: { otp_required: on } })),
    onSuccess: (r) => {
      track("source.otp.toggled", { on: r.otp_required });
      void qc.invalidateQueries({ queryKey: lookupKeys.sources(clientId) });
    },
  });

  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  const sources = q.data?.data ?? [];
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => addEmail.mutate()} loading={addEmail.isPending}>
              <Mail aria-hidden />
              {t("addEmailIn")}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("addForm")}
            </Button>
          </div>
        )}
      </div>
      {sources.length === 0 ? (
        <EmptyState icon={Globe} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="grid gap-2">
          {sources.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3">
                <SourceBadge kind={s.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-muted text-xs">
                    {s.last_received_at
                      ? t("lastReceived", { when: f.relative(s.last_received_at, now || Date.now()) })
                      : t("neverReceived")}
                    {s.requires_signature && ` · ${t("signed")}`}
                    {s.allowed_origins.length > 0 && ` · ${s.allowed_origins.join(", ")}`}
                  </p>
                  {s.inbound_address && <InboundAddress address={s.inbound_address} />}
                </div>
                {s.status === "paused" && <Badge tone="warning">{t("paused")}</Badge>}
                {s.kind === "web_form" && canManage && (
                  <label className="flex items-center gap-2 text-xs" title={t("otpHint")}>
                    <Switch
                      checked={s.otp_required}
                      onCheckedChange={(on) => otp.mutate({ s, on })}
                      aria-label={t("otpFor", { name: s.name })}
                    />
                    {t("otp")}
                  </label>
                )}
                {s.kind === "email_in" && (
                  <Button size="sm" variant="secondary" onClick={() => setGuideFor(s)}>
                    {t("emailInGuide")}
                  </Button>
                )}
                {s.kind === "web_form" && s.endpoint_url && (
                  <Button size="sm" variant="secondary" onClick={() => setSnippetFor(s)}>
                    <Code2 aria-hidden />
                    {t("snippet")}
                  </Button>
                )}
                {canManage && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={s.status === "active" ? t("pause") : t("resume")}
                    onClick={() => toggle.mutate(s)}
                  >
                    {s.status === "active" ? <Pause aria-hidden /> : <Play aria-hidden />}
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <CreateWebFormDialog clientId={clientId} onClose={() => setCreating(false)} onCreated={setSnippetFor} />
      )}
      {snippetFor && <SnippetDialog source={snippetFor} onClose={() => setSnippetFor(null)} />}
      {guideFor?.inbound_address && (
        <EmailInGuideDialog address={guideFor.inbound_address} onClose={() => setGuideFor(null)} />
      )}
    </div>
  );
}

function CreateWebFormDialog({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: (s: Source) => void;
}) {
  const t = useTranslations("sources");
  const qc = useQueryClient();
  const [name, setName] = useState("Website form");
  const [origins, setOrigins] = useState("");
  const [sign, setSign] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/sources", {
          params: { path: { clientId } },
          body: {
            kind: "web_form",
            name: name.trim(),
            allowed_origins: origins
              .split(/[\s,]+/)
              .map((o) => o.trim())
              .filter(Boolean),
            require_signature: sign,
          },
        }),
      ),
    onSuccess: (s) => {
      track("source.web_form.created", { signed: sign });
      void qc.invalidateQueries({ queryKey: lookupKeys.sources(clientId) });
      if (s.signing_secret) setSecret(s.signing_secret);
      else {
        onClose();
        onCreated(s);
      }
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("addForm")}>
        {secret ? (
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" aria-hidden />
              {t("secretOnce")}
            </p>
            <code className="bg-surface-2 rounded-lg p-3 text-sm break-all">{secret}</code>
            <Button
              onClick={() => void navigator.clipboard.writeText(secret).then(() => toast.success(t("copied")))}
              variant="secondary"
            >
              <Copy aria-hidden />
              {t("copy")}
            </Button>
            <Button onClick={onClose}>{t("done")}</Button>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field label={t("name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </Field>
            <Field label={t("origins")} hint={t("originsHint")}>
              <Input
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                placeholder="https://dhakadental.com"
              />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                {t("requireSignature")}
                <span className="text-muted block text-xs">{t("requireSignatureHint")}</span>
              </span>
              <Switch checked={sign} onCheckedChange={setSign} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
                {t("create")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SnippetDialog({ source, onClose }: { source: Source; onClose: () => void }) {
  const t = useTranslations("sources");
  const [lang, setLang] = useState<AppLocale>(useLocale() as AppLocale);
  const [sent, setSent] = useState(false);
  const { js, html } = embedSnippets(source.endpoint_url!, lang, source.otp_required);
  const copy = (v: string) => void navigator.clipboard.writeText(v).then(() => toast.success(t("copied")));
  const test = useMutation({
    mutationFn: async () => {
      const r = await fetch(source.endpoint_url!, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          name: t("testLeadName"),
          phone: "01700000000",
          utm_source: "recov_test",
          _submission_id: crypto.randomUUID(),
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => {
      track("source.test_lead.sent");
      setSent(true);
    },
    onError: () => toast.error(t("testFailed")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("snippetTitle", { name: source.name })} className="max-w-2xl">
        <div className="flex gap-2" role="radiogroup" aria-label={t("language")}>
          {LOCALES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={lang === l ? "primary" : "secondary"}
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
            >
              {LOCALE_NAMES[l]}
            </Button>
          ))}
        </div>
        <Field label={t("jsSnippet")} hint={t("jsHint")}>
          <Textarea
            readOnly
            rows={8}
            value={js}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
        </Field>
        <Button size="sm" variant="secondary" className="justify-self-start" onClick={() => copy(js)}>
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        <details>
          <summary className="text-muted cursor-pointer text-sm">{t("htmlSnippet")}</summary>
          <Textarea
            readOnly
            rows={6}
            value={html}
            className="mt-2 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => copy(html)}>
            <Copy aria-hidden />
            {t("copy")}
          </Button>
        </details>
        <Field label={t("endpoint")}>
          <Input readOnly value={source.endpoint_url!} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={() => test.mutate()} loading={test.isPending} variant="secondary">
            <Send className="rtl:-scale-x-100" aria-hidden />
            {t("sendTest")}
          </Button>
          {sent && (
            <span className="text-success flex items-center gap-1 text-sm">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("testSent")}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function copyText(value: string, done: string) {
  void navigator.clipboard.writeText(value).then(() => toast.success(done));
}

function InboundAddress({ address }: { address: string }) {
  const t = useTranslations("sources");
  return (
    <span className="mt-1 flex items-center gap-1">
      <code className="bg-surface-2 truncate rounded px-1.5 py-0.5 text-xs" dir="ltr">
        {address}
      </code>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("copyAddress")}
        onClick={() => copyText(address, t("copied"))}
      >
        <Copy aria-hidden />
      </Button>
    </span>
  );
}

function EmailInGuideDialog({ address, onClose }: { address: string; onClose: () => void }) {
  const t = useTranslations("sources");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("emailInTitle")} className="max-w-xl">
        <p className="text-muted text-sm">{t("emailInIntro")}</p>
        <div className="flex items-end gap-2">
          <Field label={t("emailInAddress")} className="flex-1">
            <Input readOnly value={address} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <Button variant="secondary" onClick={() => copyText(address, t("copied"))}>
            <Copy aria-hidden />
            {t("copy")}
          </Button>
        </div>
        <ol className="grid list-decimal gap-2 ps-5 text-sm">
          <li>{t("emailInStepPortal")}</li>
          <li>{t("emailInStepMailbox")}</li>
          <li>{t("emailInStepTest")}</li>
        </ol>
        <p className="text-muted text-xs">{t("emailInReviewNote")}</p>
        <Button className="justify-self-end" onClick={onClose}>
          {t("done")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
