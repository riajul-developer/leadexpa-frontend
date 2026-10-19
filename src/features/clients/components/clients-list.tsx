"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { localDate } from "@/shared/lib/format";
import { useApplyApiError } from "@/shared/lib/forms";
import { lookupKeys, useClients } from "@/shared/lib/lookups";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { dashboardKeys } from "@/shared/lib/query-keys";
import { useCan, useMe } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { CountrySelect } from "@/shared/ui/locale-fields";
import { Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, EmptyState, Skeleton } from "@/shared/ui/primitives";

export const INDUSTRIES = [
  "clinic",
  "healthcare",
  "real_estate",
  "ecommerce",
  "education",
  "travel",
  "automotive",
  "finance",
  "services",
  "other",
] as const;

export function ClientsList() {
  const t = useTranslations("clients");
  const f = useFormat();
  const canManage = useCan("client.manage");
  const { clients, isPending } = useClients();
  const [creating, setCreating] = useState(false);
  const tz = useDisplayTimeZone();
  const today = localDate(new Date(), tz);
  const params = { from: `${today.slice(0, 7)}-01`, to: today };
  const health = useQuery({
    queryKey: dashboardKeys.view(params),
    queryFn: () => unwrap(api.GET("/v1/dashboard", { params: { query: params } })),
    meta: { silent: true },
  });
  const byClient = new Map((health.data?.by_client ?? []).map((r) => [r.id, r]));
  const active = clients.filter((c) => c.status === "active");
  const archived = clients.filter((c) => c.status === "archived");

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        )}
      </div>
      {isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : active.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("empty")}
          description={t("emptyHint")}
          action={canManage && <Button onClick={() => setCreating(true)}>{t("add")}</Button>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr className="text-muted text-start">
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("col.name")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("col.leads")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("col.compliance")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("col.breached")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("col.revenue")}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  {t("col.health")}
                </th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => {
                const h = byClient.get(c.id);
                const compliance = h?.sla_compliance;
                const tone =
                  compliance == null
                    ? "neutral"
                    : compliance >= 0.9
                      ? "success"
                      : compliance >= 0.7
                        ? "warning"
                        : "danger";
                return (
                  <tr key={c.id} className="border-border hover:bg-surface-2 border-t">
                    <th scope="row" className="px-4 py-3 text-start font-medium">
                      <Link href={`/clients/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-muted block text-xs font-normal">
                        {t(`industry.${c.industry || "other"}`)}
                      </span>
                    </th>
                    <td className="px-4 py-3 tabular-nums">{h ? f.number(h.leads_received) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{f.percent(compliance)}</td>
                    <td className="px-4 py-3 tabular-nums">{h ? f.number(h.sla_breached) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {h?.revenue_minor != null && h.currency
                        ? f.money({ amount_minor: h.revenue_minor, currency: h.currency })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Badge tone={tone}>{t(`health.${tone}`)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {archived.length > 0 && (
        <details>
          <summary className="text-muted cursor-pointer text-sm">{t("archived", { count: archived.length })}</summary>
          <ul className="mt-2 grid gap-1 text-sm">
            {archived.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="text-muted hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {creating && <CreateClientDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export function CreateClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const t = useTranslations("clients");
  const tv = useTranslations("validation");
  const qc = useQueryClient();
  const router = useRouter();
  const { data: me } = useMe();
  const schema = z.object({
    name: z.string().trim().min(1, tv("required")).max(200),
    industry: z.enum(INDUSTRIES),
    assignment_strategy: z.enum(["round_robin", "manual", "fixed_owner"]),
    country: z.string().length(2),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      industry: "clinic",
      assignment_strategy: "round_robin",
      country: me?.agency?.country ?? "",
    },
  });
  const apply = useApplyApiError(form.setError);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (v: Values) =>
      unwrap(
        api.POST("/v1/clients", {
          // Timezone and currency are derived from the country server-side.
          body: { ...v, dedup_window_days: 30 },
        }),
      ),
    meta: { silent: true },
    onSuccess: (c) => {
      track("client.created", { industry: c.industry });
      void qc.invalidateQueries({ queryKey: lookupKeys.clients });
      onClose();
      if (onCreated) onCreated(c.id);
      else router.push(`/clients/${c.id}`);
    },
    onError: (e) => setError(apply(e, ["name", "industry", "assignment_strategy", "country"])),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("add")} className="max-w-2xl">
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          {error && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label={t("form.name")} error={form.formState.errors.name?.message}>
              <Input autoFocus {...form.register("name")} />
            </Field>
            <Field label={t("form.industry")}>
              <NativeSelect {...form.register("industry")}>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {t(`industry.${i}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("form.country")} hint={t("form.countryHint")}>
              <CountrySelect
                value={form.watch("country")}
                onValueChange={(v) => form.setValue("country", v, { shouldValidate: true })}
              />
            </Field>
            <Field label={t("form.strategy")} hint={t(`strategyHint.${form.watch("assignment_strategy")}`)}>
              <NativeSelect {...form.register("assignment_strategy")}>
                {(["round_robin", "manual", "fixed_owner"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`strategy.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
