"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Megaphone, Plus, Trash2, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { api, API_URL, readCookie, CSRF_COOKIE, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";
import { toApiError } from "@/shared/lib/api/errors";
import { lookupKeys, useMembers, type Client } from "@/shared/lib/lookups";
import { clientKeys } from "@/shared/lib/query-keys";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/overlays";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { INDUSTRIES } from "./clients-list";
import { SmartRoutingFields } from "./routing";

// ---------------------------------------------------------------------------------------------
// Overview: client settings

export function ClientSettings({ client }: { client: Client }) {
  const t = useTranslations("clients");
  const ts = useTranslations("source.subType");
  const qc = useQueryClient();
  const canManage = useCan("client.manage");
  const { members } = useMembers();
  const [draft, setDraft] = useState({ ...client });
  useEffect(() => setDraft({ ...client }), [client]);
  const save = useMutation({
    mutationFn: (patch: Schemas["ClientPatch"]) =>
      unwrap(api.PATCH("/v1/clients/{clientId}", { params: { path: { clientId: client.id } }, body: patch })),
    onSuccess: (c) => {
      qc.setQueryData(clientKeys.detail(client.id), c);
      void qc.invalidateQueries({ queryKey: lookupKeys.clients });
      toast.success(t("saved"));
    },
  });
  const zones =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [client.timezone, "UTC"];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              name: draft.name.trim(),
              industry: draft.industry,
              timezone: draft.timezone,
              currency: draft.currency,
              assignment_strategy: draft.assignment_strategy,
              fixed_owner_user_id: draft.assignment_strategy === "fixed_owner" ? draft.fixed_owner_user_id : null,
              dedup_window_days: draft.dedup_window_days,
              manual_responded_sub_types: draft.manual_responded_sub_types,
              ...(draft.assignment_strategy === "smart"
                ? {
                    routing_max_open: draft.routing_max_open,
                    routing_use_skills: draft.routing_use_skills,
                    routing_hot_to_fastest: draft.routing_hot_to_fastest,
                  }
                : {}),
            });
          }}
        >
          <Field label={t("form.name")}>
            <Input
              value={draft.name}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label={t("form.industry")}>
            <NativeSelect
              value={draft.industry || "other"}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {t(`industry.${i}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("form.timezone")}>
            <NativeSelect
              value={draft.timezone}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("form.currency")}>
            <Input
              value={draft.currency}
              maxLength={3}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label={t("form.strategy")} hint={t(`strategyHint.${draft.assignment_strategy}`)}>
            <NativeSelect
              value={draft.assignment_strategy}
              disabled={!canManage}
              onChange={(e) =>
                setDraft({ ...draft, assignment_strategy: e.target.value as Client["assignment_strategy"] })
              }
            >
              {(["round_robin", "smart", "manual", "fixed_owner"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`strategy.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {draft.assignment_strategy === "smart" && (
            <SmartRoutingFields draft={draft} disabled={!canManage} onChange={(d) => setDraft({ ...draft, ...d })} />
          )}
          {draft.assignment_strategy === "fixed_owner" && (
            <Field label={t("form.fixedOwner")}>
              <NativeSelect
                value={draft.fixed_owner_user_id ?? ""}
                disabled={!canManage}
                onChange={(e) => setDraft({ ...draft, fixed_owner_user_id: e.target.value || null })}
              >
                <option value="">—</option>
                {members
                  .filter((m) => m.status === "active")
                  .map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
          <Field label={t("form.dedup")} hint={t("form.dedupHint")}>
            <Input
              type="number"
              min={1}
              max={365}
              value={draft.dedup_window_days}
              disabled={!canManage}
              onChange={(e) => setDraft({ ...draft, dedup_window_days: Number(e.target.value) || 30 })}
            />
          </Field>
          <fieldset className="grid gap-2 sm:col-span-2 lg:col-span-3">
            <legend className="text-sm font-medium">{t("form.respondedSubTypes")}</legend>
            <p className="text-muted text-xs">{t("form.respondedSubTypesHint")}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["walk_in", "phone_call"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.manual_responded_sub_types.includes(s)}
                    disabled={!canManage}
                    onCheckedChange={(on) =>
                      setDraft({
                        ...draft,
                        manual_responded_sub_types: on
                          ? [...draft.manual_responded_sub_types, s]
                          : draft.manual_responded_sub_types.filter((x) => x !== s),
                      })
                    }
                  />
                  {ts(s)}
                </label>
              ))}
            </div>
          </fieldset>
          {canManage && (
            <div className="flex flex-wrap items-end justify-between gap-2 sm:col-span-2 lg:col-span-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (client.status === "active" && !window.confirm(t("archiveConfirm"))) return;
                  save.mutate({ status: client.status === "active" ? "archived" : "active" });
                }}
              >
                {client.status === "active" ? t("archive") : t("unarchive")}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t("save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Team: who works this client, rotation and escalations

export function TeamTab({ clientId, smart = false }: { clientId: string; smart?: boolean }) {
  const t = useTranslations("clients.team");
  const tr = useTranslations("roles");
  const qc = useQueryClient();
  const canManage = useCan("client.manage");
  const { members, byUserId } = useMembers();
  const q = useQuery({
    queryKey: clientKeys.assignments(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/assignments", { params: { path: { clientId } } })),
  });
  const set = useMutation({
    mutationFn: (v: {
      userId: string;
      in_round_robin?: boolean;
      receives_escalations?: boolean;
      routing_weight?: number;
      max_open?: number | null;
    }) => {
      // Send the row's current switches too, so changing one never resets the other.
      const cur = q.data?.data.find((a) => a.user_id === v.userId);
      return unwrap(
        api.PUT("/v1/clients/{clientId}/assignments/{userId}", {
          params: { path: { clientId, userId: v.userId } },
          body: {
            in_round_robin: v.in_round_robin ?? cur?.in_round_robin ?? true,
            receives_escalations: v.receives_escalations ?? cur?.receives_escalations ?? false,
            ...(v.routing_weight !== undefined ? { routing_weight: v.routing_weight } : {}),
            ...(v.max_open !== undefined ? { max_open: v.max_open } : {}),
          },
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.assignments(clientId) }),
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      unwrapEmpty(
        api.DELETE("/v1/clients/{clientId}/assignments/{userId}", { params: { path: { clientId, userId } } }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.assignments(clientId) }),
  });
  const [adding, setAdding] = useState("");
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  const rows = q.data?.data ?? [];
  const assigned = new Set(rows.map((r) => r.user_id));
  const candidates = members.filter(
    (m) => m.status === "active" && !assigned.has(m.user.id) && m.role !== "client_viewer",
  );
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-start">
                <th scope="col" className="py-2 font-medium">
                  {t("member")}
                </th>
                <th scope="col" className="py-2 text-center font-medium">
                  {t("rotation")}
                </th>
                <th scope="col" className="py-2 text-center font-medium">
                  {t("escalations")}
                </th>
                {smart && (
                  <>
                    <th scope="col" className="py-2 text-center font-medium">
                      {t("weight")}
                    </th>
                    <th scope="col" className="py-2 text-center font-medium">
                      {t("maxOpen")}
                    </th>
                  </>
                )}
                <th scope="col" className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const m = byUserId.get(a.user_id);
                const name = m?.user.name ?? a.user_id.slice(0, 8);
                return (
                  <tr key={a.user_id} className="border-border border-t">
                    <th scope="row" className="py-2 text-start font-normal">
                      <span className="flex items-center gap-2">
                        <Avatar name={name} size="sm" />
                        <span>
                          {name}
                          <span className="text-muted block text-xs">
                            {tr(a.role)}
                            {!a.available && ` · ${t("away")}`}
                            {!a.member_active && ` · ${t("inactive")}`}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="text-center">
                      <Switch
                        checked={a.in_round_robin}
                        disabled={!canManage}
                        onCheckedChange={(v) => set.mutate({ userId: a.user_id, in_round_robin: v })}
                        aria-label={t("rotationFor", { name })}
                      />
                    </td>
                    <td className="text-center">
                      <Switch
                        checked={a.receives_escalations}
                        disabled={!canManage}
                        onCheckedChange={(v) => set.mutate({ userId: a.user_id, receives_escalations: v })}
                        aria-label={t("escalationsFor", { name })}
                      />
                    </td>
                    {smart && (
                      <>
                        <td className="text-center">
                          <NativeSelect
                            className="mx-auto h-8 w-16"
                            value={a.routing_weight}
                            disabled={!canManage}
                            aria-label={t("weightFor", { name })}
                            onChange={(e) => set.mutate({ userId: a.user_id, routing_weight: Number(e.target.value) })}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>
                                {n}×
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="text-center">
                          <Input
                            type="number"
                            min={1}
                            className="mx-auto h-8 w-20"
                            defaultValue={a.max_open ?? ""}
                            placeholder={t("clientCap")}
                            disabled={!canManage}
                            aria-label={t("maxOpenFor", { name })}
                            onBlur={(e) => {
                              const v = e.target.value ? Math.max(1, Number(e.target.value)) : null;
                              if (v !== a.max_open) set.mutate({ userId: a.user_id, max_open: v });
                            }}
                          />
                        </td>
                      </>
                    )}
                    <td>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("remove", { name })}
                          onClick={() => remove.mutate(a.user_id)}
                        >
                          <UserMinus aria-hidden />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {canManage && candidates.length > 0 && (
          <div className="flex gap-2">
            <NativeSelect value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={t("add")}>
              <option value="">{t("pick")}</option>
              {candidates.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name} · {tr(m.role)}
                </option>
              ))}
            </NativeSelect>
            <Button
              disabled={!adding}
              onClick={() => {
                set.mutate({ userId: adding, in_round_robin: true });
                setAdding("");
              }}
            >
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Campaigns + ad spend CSV import

export function CampaignsTab({ clientId }: { clientId: string }) {
  const t = useTranslations("clients.campaigns");
  const canImport = useCan("lead.import");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const q = useQuery({
    queryKey: clientKeys.campaigns(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/campaigns", { params: { path: { clientId } } })),
  });
  const upload = useMutation({
    // Multipart: openapi-fetch serializes JSON, so post the file directly (CSRF + idempotency by hand).
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/v1/clients/${clientId}/ad-spend`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": readCookie(CSRF_COOKIE) ?? "", "Idempotency-Key": crypto.randomUUID() },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw toApiError(res, json);
      return json as { imported: number; errors: { row: number; reason: string }[] };
    },
    onSuccess: (r) => {
      toast.success(t("imported", { count: r.imported }));
      if (r.errors.length)
        toast.warning(
          t("importErrors", {
            count: r.errors.length,
            rows: r.errors
              .slice(0, 5)
              .map((e) => e.row)
              .join(", "),
          }),
        );
      void qc.invalidateQueries({ queryKey: clientKeys.campaigns(clientId) });
    },
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        {canImport && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
              aria-label={t("importSpend")}
            />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
              <FileUp aria-hidden />
              {t("importSpend")}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-muted mb-3 text-xs">{t("csvFormat")}</p>
        {q.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !q.data?.data.length ? (
          <EmptyState icon={Megaphone} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <ul className="grid gap-2 text-sm">
            {q.data.data.map((c) => (
              <li key={c.id} className="border-border flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="truncate">{c.name}</span>
                <Badge tone={c.platform === "meta" ? "primary" : "neutral"}>{c.platform}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// AI profile: what the assistant knows about this client

export function AiProfileTab({ clientId }: { clientId: string }) {
  const t = useTranslations("clients.ai");
  const qc = useQueryClient();
  const canManage = useCan("client.manage");
  const q = useQuery({
    queryKey: clientKeys.aiProfile(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/ai-profile", { params: { path: { clientId } } })),
  });
  const [p, setP] = useState<{
    business_description: string;
    offer: string;
    tone: "friendly" | "formal" | "short";
    faqs: { q: string; a: string }[];
  } | null>(null);
  useEffect(() => {
    if (q.data)
      setP({
        business_description: q.data.business_description,
        offer: q.data.offer,
        tone: (q.data.tone as "friendly") || "friendly",
        faqs: q.data.faqs,
      });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      unwrap(api.PUT("/v1/clients/{clientId}/ai-profile", { params: { path: { clientId } }, body: p! })),
    onSuccess: (r) => {
      qc.setQueryData(clientKeys.aiProfile(clientId), r);
      toast.success(t("saved"));
    },
  });
  if (!p) return <Skeleton className="h-64 w-full" />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label={t("description")}>
          <Textarea
            rows={3}
            maxLength={2000}
            value={p.business_description}
            disabled={!canManage}
            onChange={(e) => setP({ ...p, business_description: e.target.value })}
          />
        </Field>
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label={t("offer")}>
            <Textarea
              rows={2}
              maxLength={1000}
              value={p.offer}
              disabled={!canManage}
              onChange={(e) => setP({ ...p, offer: e.target.value })}
            />
          </Field>
          <Field label={t("tone")}>
            <NativeSelect
              value={p.tone}
              disabled={!canManage}
              onChange={(e) => setP({ ...p, tone: e.target.value as "friendly" })}
            >
              {(["friendly", "formal", "short"] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`tones.${x}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t("faqs")}</p>
          {p.faqs.map((faq, i) => (
            <div key={i} className="border-border grid gap-2 rounded-lg border p-3">
              <Input
                placeholder={t("question")}
                value={faq.q}
                maxLength={300}
                disabled={!canManage}
                onChange={(e) =>
                  setP({ ...p, faqs: p.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })
                }
                aria-label={t("question")}
              />
              <Textarea
                rows={2}
                placeholder={t("answer")}
                value={faq.a}
                maxLength={1000}
                disabled={!canManage}
                onChange={(e) =>
                  setP({ ...p, faqs: p.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })
                }
                aria-label={t("answer")}
              />
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-end"
                  onClick={() => setP({ ...p, faqs: p.faqs.filter((_, j) => j !== i) })}
                >
                  <Trash2 aria-hidden />
                  {t("remove")}
                </Button>
              )}
            </div>
          ))}
          {canManage && p.faqs.length < 20 && (
            <Button
              variant="secondary"
              size="sm"
              className="justify-self-start"
              onClick={() => setP({ ...p, faqs: [...p.faqs, { q: "", a: "" }] })}
            >
              <Plus aria-hidden />
              {t("addFaq")}
            </Button>
          )}
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              {t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
