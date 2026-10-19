"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { api, unwrap, type Schemas } from "@/shared/lib/api/client";
import { useMembers } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

type RoutingDraft = {
  routing_max_open: number | null;
  routing_use_skills: boolean;
  routing_hot_to_fastest: boolean;
};

export function SmartRoutingFields({
  draft,
  disabled,
  onChange,
}: {
  draft: RoutingDraft;
  disabled: boolean;
  onChange: (d: Partial<RoutingDraft>) => void;
}) {
  const t = useTranslations("clients.routing");
  return (
    <fieldset className="bg-surface-2 grid gap-3 rounded-lg p-3 sm:col-span-2">
      <legend className="sr-only">{t("title")}</legend>
      <Field label={t("maxOpen")} hint={t("maxOpenHint")}>
        <Input
          type="number"
          min={1}
          className="max-w-32"
          value={draft.routing_max_open ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ routing_max_open: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={draft.routing_use_skills}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ routing_use_skills: v })}
        />
        {t("useSkills")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={draft.routing_hot_to_fastest}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ routing_hot_to_fastest: v })}
        />
        {t("hotToFastest")}
      </label>
    </fieldset>
  );
}

type Decision = Schemas["RoutingDecision"];
type Step = { step: string; field?: string; value?: string; kept?: number; ignored?: boolean; excluded?: number };

export function RoutingLog({ clientId }: { clientId: string }) {
  const t = useTranslations("clients.routing");
  const f = useFormat();
  const tz = useDisplayTimeZone();
  const { byUserId } = useMembers();
  const q = useQuery({
    queryKey: ["clients", clientId, "routing-decisions"],
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/routing-decisions", { params: { path: { clientId } } })),
  });
  const explain = (d: Decision) => {
    const r = d.reason as { rule?: string; steps?: Step[]; median_minutes?: number; weight?: number; recent?: number };
    const parts: string[] = [];
    for (const s of r.steps ?? []) {
      if (s.step === "skill")
        parts.push(
          s.ignored
            ? t("step.skillIgnored", { field: t(`field.${s.field}`), value: s.value ?? "" })
            : t("step.skill", { field: t(`field.${s.field}`), value: s.value ?? "", kept: s.kept ?? 0 }),
        );
      if (s.step === "capacity") parts.push(t("step.capacity", { count: s.excluded ?? 0 }));
    }
    if (r.rule === "fastest_responder") parts.push(t("rule.fastest", { minutes: f.number(r.median_minutes ?? 0) }));
    else if (r.rule === "weighted_balance")
      parts.push(t("rule.balance", { weight: r.weight ?? 1, recent: r.recent ?? 0 }));
    else if (r.rule) parts.push(t.has(`rule.${r.rule}`) ? t(`rule.${r.rule}`) : r.rule);
    return parts.join(" · ");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="text-accent size-5" aria-hidden />
          {t("log")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (q.data?.data.length ?? 0) === 0 ? (
          <EmptyState title={t("logEmpty")} />
        ) : (
          <ul className="divide-border grid divide-y">
            {q.data!.data.slice(0, 30).map((d) => (
              <li key={d.id} className="grid gap-0.5 py-2.5 text-sm" data-rule={(d.reason as { rule?: string }).rule}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {d.chosen_user_id ? (byUserId.get(d.chosen_user_id)?.user.name ?? "—") : t("unassigned")}
                  </span>
                  <span className="text-muted text-xs">{f.dateTime(d.created_at, tz, "short")}</span>
                </div>
                <span className="text-muted text-xs">{explain(d)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MemberSkillsCard() {
  const t = useTranslations("clients.skills");
  const qc = useQueryClient();
  const { members } = useMembers();
  const q = useQuery({ queryKey: ["member-skills"], queryFn: () => unwrap(api.GET("/v1/member-skills")) });
  const save = useMutation({
    mutationFn: (v: { userId: string; languages: string[]; product_lines: string[] }) =>
      unwrap(
        api.PUT("/v1/member-skills/{userId}", {
          params: { path: { userId: v.userId } },
          body: { languages: v.languages, product_lines: v.product_lines },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["member-skills"] });
      toast.success(t("saved"));
    },
  });
  const skills = new Map((q.data?.data ?? []).map((s) => [s.user_id, s]));
  const active = members.filter((m) => m.status === "active" && m.role !== "client_viewer");
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="grid gap-3">
            {active.map((m) => (
              <SkillRow
                key={m.user.id}
                name={m.user.name}
                initial={skills.get(m.user.id)}
                saving={save.isPending && save.variables?.userId === m.user.id}
                onSave={(languages, product_lines) => save.mutate({ userId: m.user.id, languages, product_lines })}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

function SkillRow({
  name,
  initial,
  saving,
  onSave,
}: {
  name: string;
  initial?: Schemas["MemberSkills"];
  saving: boolean;
  onSave: (languages: string[], productLines: string[]) => void;
}) {
  const t = useTranslations("clients.skills");
  const [langs, setLangs] = useState((initial?.languages ?? []).join(", "));
  const [products, setProducts] = useState((initial?.product_lines ?? []).join(", "));
  const dirty =
    langs !== (initial?.languages ?? []).join(", ") || products !== (initial?.product_lines ?? []).join(", ");
  return (
    <li
      className="border-border grid gap-2 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end"
      data-member={name}
    >
      <span className="font-medium sm:pb-2">{name}</span>
      <Field label={t("languages")}>
        <Input value={langs} placeholder="bn, en, ar" dir="ltr" onChange={(e) => setLangs(e.target.value)} />
      </Field>
      <Field label={t("products")}>
        <Input value={products} placeholder={t("productsPlaceholder")} onChange={(e) => setProducts(e.target.value)} />
      </Field>
      <Button
        variant="secondary"
        disabled={!dirty}
        loading={saving}
        onClick={() => onSave(split(langs), split(products))}
      >
        {t("save")}
      </Button>
      {(initial?.languages.length ?? 0) > 0 && !dirty && (
        <div className="flex flex-wrap gap-1 sm:col-span-4">
          {initial!.languages.map((l) => (
            <Badge key={l} tone="info">
              {l}
            </Badge>
          ))}
        </div>
      )}
    </li>
  );
}
