"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PartyPopper, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CreateClientDialog } from "@/features/clients";
import { embedSnippets } from "@/features/sources";
import { Link, useRouter } from "@/i18n/navigation";
import { browserTimeZone } from "@/shared/config/countries";
import { toApiLocale, type AppLocale } from "@/shared/config/locales";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { cn } from "@/shared/lib/cn";
import { lookupKeys, useClients, useSources } from "@/shared/lib/lookups";
import { realtime } from "@/shared/lib/realtime";
import { meKey, useMe } from "@/shared/lib/session";
import { BrandWordmark } from "@/shared/ui/brand";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { CountrySelect, LocaleSelect, TimeZoneSelect } from "@/shared/ui/locale-fields";
import { Switch } from "@/shared/ui/overlays";
import { Card, Skeleton } from "@/shared/ui/primitives";

import { ONBOARDING_STEPS, type OnboardingStep } from "../steps";

const PRESETS = { fast: 5, standard: 15, relaxed: 60 } as const;

export function Onboarding({ step }: { step: OnboardingStep }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { data: me, isPending } = useMe();
  const { clients } = useClients();
  const clientId = clients.find((c) => c.status === "active")?.id;
  const index = ONBOARDING_STEPS.indexOf(step);
  const next = () => {
    track("onboarding.step.completed", { step });
    const n = ONBOARDING_STEPS[index + 1];
    if (n) router.push(`/onboarding/${n}`);
  };
  useEffect(() => {
    if (!isPending && !me) router.replace("/login?returnTo=/onboarding/agency");
  }, [isPending, me, router]);
  if (!me) return <Skeleton className="m-6 h-64" />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-8">
      <BrandWordmark />
      <ol className="flex gap-1" aria-label={t("progress")}>
        {ONBOARDING_STEPS.map((s, i) => (
          <li
            key={s}
            className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-primary" : "bg-border")}
            aria-current={s === step ? "step" : undefined}
          >
            <span className="sr-only">{t(`steps.${s}`)}</span>
          </li>
        ))}
      </ol>
      <Card className="grid gap-4 p-5">
        <div>
          <p className="text-muted text-sm">{t("stepOf", { n: index + 1, total: ONBOARDING_STEPS.length })}</p>
          <h1 className="text-xl font-semibold">{t(`title.${step}`)}</h1>
          <p className="text-muted text-sm">{t(`hint.${step}`)}</p>
        </div>
        {step === "agency" && <AgencyStep onDone={next} />}
        {step === "client" && <ClientStep clientId={clientId} onDone={next} />}
        {step === "sla" && (clientId ? <SlaStep clientId={clientId} onDone={next} /> : <NeedClient />)}
        {step === "source" && (clientId ? <SourceStep clientId={clientId} onDone={next} /> : <NeedClient />)}
        {step === "team" && <TeamStep onDone={next} />}
        {step === "done" && <DoneStep />}
      </Card>
      {step !== "done" && step !== "agency" && (
        <button type="button" className="text-muted hover:text-text self-center text-sm" onClick={next}>
          {t("skip")}
        </button>
      )}
    </main>
  );
}

function NeedClient() {
  const t = useTranslations("onboarding");
  return (
    <Button asChild variant="secondary">
      <Link href="/onboarding/client">{t("addClientFirst")}</Link>
    </Button>
  );
}

function AgencyStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations("onboarding.agency");
  const qc = useQueryClient();
  const { data: me } = useMe();
  const uiLocale = useLocale() as AppLocale;
  const [name, setName] = useState(me?.agency?.name ?? "");
  const [country, setCountry] = useState(me?.agency?.country ?? "");
  const [tz, setTz] = useState(me?.agency?.default_timezone ?? browserTimeZone());
  const [currency, setCurrency] = useState(me?.agency?.default_currency ?? "");
  const [locale, setLocale] = useState<AppLocale>(me?.agency?.default_locale ?? uiLocale);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH("/v1/agencies/current", {
          body: {
            name: name.trim(),
            ...(country ? { country } : {}),
            default_timezone: tz,
            ...(currency.length === 3 ? { default_currency: currency } : {}),
            default_locale: toApiLocale(locale),
          },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: meKey });
      onDone();
    },
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label={t("name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </Field>
      <Field label={t("country")}>
        <CountrySelect value={country} onValueChange={setCountry} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("timezone")}>
          <TimeZoneSelect value={tz} onValueChange={setTz} />
        </Field>
        <Field label={t("currency")}>
          <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
      </div>
      <Field label={t("language")}>
        <LocaleSelect value={locale} onValueChange={setLocale} />
      </Field>
      <Button type="submit" size="lg" loading={save.isPending}>
        {t("continue")}
      </Button>
    </form>
  );
}

function ClientStep({ clientId, onDone }: { clientId?: string; onDone: () => void }) {
  const t = useTranslations("onboarding.client");
  const { byId } = useClients();
  const [open, setOpen] = useState(!clientId);
  const qc = useQueryClient();
  if (clientId && !open) {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="text-success size-4" aria-hidden />
          {t("added", { name: byId.get(clientId)?.name ?? "" })}
        </p>
        <p className="text-muted text-sm">{t("hoursHint")}</p>
        <Button size="lg" onClick={onDone}>
          {t("continue")}
        </Button>
      </div>
    );
  }
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {t("add")}
      </Button>
      {open && (
        <CreateClientDialog
          onClose={() => setOpen(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: lookupKeys.clients });
            setOpen(false);
            onDone();
          }}
        />
      )}
    </>
  );
}

function SlaStep({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const t = useTranslations("onboarding.sla");
  const ts = useTranslations("sla.editor");
  const [preset, setPreset] = useState<keyof typeof PRESETS>("standard");
  const [businessHours, setBusinessHours] = useState(true);
  const policy = {
    active: true,
    first_response_minutes: PRESETS[preset],
    business_hours_only: businessHours,
    measure: "attempt" as const,
    warn_at_percent: 80,
    escalation_ladder: [
      {
        level: 1,
        after_breach_minutes: 0,
        notify: ["owner", "client_managers"] as ("owner" | "client_managers" | "agency_admins")[],
      },
      {
        level: 2,
        after_breach_minutes: 60,
        notify: ["agency_admins"] as ("owner" | "client_managers" | "agency_admins")[],
      },
    ],
  };
  const arrival = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7 || 7));
    d.setUTCHours(12, 55, 0, 0); // 18:55 in Dhaka
    return d.toISOString();
  })();
  const preview = useQuery({
    queryKey: ["onboarding-sla-preview", clientId, preset, businessHours],
    queryFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/sla-policy/preview", {
          params: { path: { clientId } },
          body: { received_at: arrival, policy },
        }),
      ),
    meta: { silent: true },
  });
  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PUT("/v1/clients/{clientId}/sla-policy", { params: { path: { clientId } }, body: policy })),
    onSuccess: onDone,
  });
  const fmt = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: tz }).format(
      new Date(iso),
    );
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("presets")}>
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={preset === k}
            onClick={() => setPreset(k)}
            className={cn(
              "rounded-card border p-3 text-start",
              preset === k ? "border-primary bg-primary-soft" : "border-border",
            )}
          >
            <span className="block font-semibold">{ts(`preset.${k}`)}</span>
            <span className="text-muted text-sm">{ts("minutes", { n: PRESETS[k] })}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          {ts("businessHours")}
          <span className="text-muted block">{t("hoursPreset")}</span>
        </span>
        <Switch checked={businessHours} onCheckedChange={setBusinessHours} />
      </label>
      <p role="status" aria-live="polite" className="bg-info-soft text-info rounded-lg px-3 py-2 text-sm">
        {preview.data
          ? t("preview", {
              arrival: fmt(preview.data.received_at, preview.data.timezone),
              due: fmt(preview.data.due_at, preview.data.timezone),
            })
          : "…"}
      </p>
      <Button size="lg" onClick={() => save.mutate()} loading={save.isPending}>
        {t("continue")}
      </Button>
    </div>
  );
}

function SourceStep({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const t = useTranslations("onboarding.source");
  const locale = useLocale() as AppLocale;
  const qc = useQueryClient();
  const sources = useSources(clientId);
  const form = sources.data?.data.find((s) => s.kind === "web_form");
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/v1/clients/{clientId}/sources", {
          params: { path: { clientId } },
          body: { kind: "web_form", name: "Website form" },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.sources(clientId) }),
  });
  const test = useMutation({
    mutationFn: async () => {
      const r = await fetch(form!.endpoint_url!, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          name: t("testName"),
          phone: "01700000000",
          utm_source: "recov_test",
          _submission_id: crypto.randomUUID(),
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => {
      track("source.test_lead.received");
      sessionStorage.setItem("recov-onboarding-test", String(Date.now()));
      onDone();
    },
  });
  if (sources.isPending) return <Skeleton className="h-32 w-full" />;
  if (!form)
    return (
      <Button size="lg" onClick={() => create.mutate()} loading={create.isPending}>
        {t("createForm")}
      </Button>
    );
  const { js } = embedSnippets(form.endpoint_url!, locale);
  return (
    <div className="grid gap-3">
      <Field label={t("snippet")} hint={t("snippetHint")}>
        <Textarea
          readOnly
          rows={6}
          className="font-mono text-xs"
          value={js}
          onFocus={(e) => e.currentTarget.select()}
        />
      </Field>
      <p className="text-muted text-sm">
        {t("alternatives")}{" "}
        <Link className="text-primary" href={`/imports/new?client=${clientId}`}>
          {t("csv")}
        </Link>{" "}
        ·{" "}
        <Link className="text-primary" href="/integrations/meta">
          {t("meta")}
        </Link>
      </p>
      <Button size="lg" onClick={() => test.mutate()} loading={test.isPending}>
        <Send className="rtl:-scale-x-100" aria-hidden />
        {t("sendTest")}
      </Button>
    </div>
  );
}

function TeamStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations("onboarding.team");
  const tr = useTranslations("roles");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agent" | "manager" | "admin">("agent");
  const [sent, setSent] = useState<string[]>([]);
  const invite = useMutation({
    mutationFn: () => unwrap(api.POST("/v1/invites", { body: { email: email.trim(), role } })),
    onSuccess: () => {
      track("team.invite.sent", { role, from: "onboarding" });
      setSent([...sent, email.trim()]);
      setEmail("");
    },
  });
  return (
    <div className="grid gap-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          invite.mutate();
        }}
      >
        <Input
          type="email"
          required
          className="min-w-0 flex-1"
          placeholder="agent@agency.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t("email")}
        />
        <NativeSelect
          className="w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value as "agent")}
          aria-label={t("role")}
        >
          {(["agent", "manager", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary" loading={invite.isPending}>
          {t("invite")}
        </Button>
      </form>
      {sent.length > 0 && (
        <ul className="text-success text-sm">
          {sent.map((s) => (
            <li key={s} className="flex items-center gap-1">
              <CheckCircle2 className="size-4" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      )}
      <Button size="lg" onClick={onDone}>
        {t("continue")}
      </Button>
    </div>
  );
}

function DoneStep() {
  const t = useTranslations("onboarding.done");
  const [arrived, setArrived] = useState(false);
  const sentTest = typeof window !== "undefined" && !!sessionStorage.getItem("recov-onboarding-test");
  useEffect(() => {
    realtime.start();
    const off = realtime.subscribe((e) => {
      if (e.type === "lead.created") {
        setArrived(true);
        track("onboarding.first_lead.arrived");
      }
    });
    // It may have arrived before this page subscribed: check the inbox once.
    void unwrap(api.GET("/v1/leads", { params: { query: { limit: 1 } } }))
      .then((r) => r.data.length > 0 && setArrived(true))
      .catch(() => undefined);
    return off;
  }, []);
  return (
    <div className="grid justify-items-center gap-4 py-4 text-center">
      {arrived || !sentTest ? (
        <PartyPopper className="text-primary size-12" aria-hidden />
      ) : (
        <Loader2 className="text-muted size-10 animate-spin" aria-hidden />
      )}
      <p className="text-base font-medium" aria-live="polite">
        {arrived ? t("arrived") : sentTest ? t("waiting") : t("ready")}
      </p>
      <Button size="lg" asChild>
        <Link href="/inbox">{t("openInbox")}</Link>
      </Button>
    </div>
  );
}
