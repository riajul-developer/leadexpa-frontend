"use client";

// Loaded on demand from QuickAddLead (React Hook Form + Zod stay out of every page's first load).

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRoundSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { composePhone } from "@/shared/config/countries";
import { useActiveClient } from "@/shared/hooks/use-active-client";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { api, unwrap } from "@/shared/lib/api/client";
import { extractPhone, toLatinDigits } from "@/shared/lib/format";
import { useApplyApiError } from "@/shared/lib/forms";
import { useClients } from "@/shared/lib/lookups";
import { inboxKeys, leadKeys } from "@/shared/lib/query-keys";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { StageBadge } from "@/shared/ui/badges";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";
import { PhoneInput } from "@/shared/ui/phone-input";

const SUB_TYPES = ["phone_call", "walk_in", "referral", "facebook_message", "other"] as const;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function QuickAddForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("quickAdd");
  const tv = useTranslations("validation");
  const ts = useTranslations("source.subType");
  const f = useFormat();
  const now = useNow();
  const router = useRouter();
  const qc = useQueryClient();
  const active = useActiveClient();
  const { clients } = useClients();
  const activeClients = clients.filter((c) => c.status === "active");
  const schema = z
    .object({
      client_id: z.string().min(1, tv("required")),
      full_name: z.string().max(200),
      phone: z.string().max(40),
      sub_type: z.enum(SUB_TYPES),
      note: z.string().max(5000),
    })
    .refine((v) => v.phone.trim() !== "", { path: ["phone"], message: tv("phoneRequired") });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: active ?? activeClients[0]?.id ?? "",
      full_name: "",
      phone: "",
      sub_type: "phone_call",
      note: "",
    },
  });
  const apply = useApplyApiError(form.setError);
  const [error, setError] = useState<string | null>(null);

  const phone = useDebounced(toLatinDigits(form.watch("phone")).replace(/\D/g, ""), 350);
  const clientId = form.watch("client_id");
  // The country code picker follows the chosen client; a different country adds its dialing code.
  const clientCountry = clients.find((c) => c.id === clientId)?.country ?? "";
  const [dialCountry, setDialCountry] = useState(clientCountry);
  useEffect(() => setDialCountry(clientCountry), [clientCountry]);
  const dupes = useQuery({
    queryKey: ["quick-add-dupes", clientId, phone],
    queryFn: () => unwrap(api.GET("/v1/leads", { params: { query: { q: phone, client_id: clientId, limit: 3 } } })),
    enabled: phone.length >= 10 && !!clientId,
    meta: { silent: true },
  });
  const dupe = dupes.data?.data[0];

  const create = useMutation({
    mutationFn: (v: Values) =>
      unwrap(
        api.POST("/v1/leads", {
          body: {
            client_id: v.client_id,
            full_name: v.full_name.trim(),
            phone: composePhone(toLatinDigits(v.phone), dialCountry, clientCountry),
            sub_type: v.sub_type,
            note: v.note.trim() || undefined,
          },
        }),
      ),
    meta: { silent: true },
    onSuccess: (lead) => {
      track("lead.manual.created", { sub_type: form.getValues("sub_type") });
      qc.setQueryData(leadKeys.detail(lead.id), lead);
      void qc.invalidateQueries({ queryKey: inboxKeys.all });
      void qc.invalidateQueries({ queryKey: leadKeys.lists() });
      toast.success(t("created"));
      onDone();
      router.push(`/leads/${lead.id}`);
    },
    onError: (e) => setError(apply(e, ["full_name", "phone", "client_id", "note"])),
  });

  // Paste-to-fill: a pasted message with a number fills the phone field (Bangla digits ok).
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const found = extractPhone(e.clipboardData.getData("text"));
    if (found) {
      e.preventDefault();
      form.setValue("phone", found, { shouldValidate: true });
    }
  };
  const err = form.formState.errors;
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
      {error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <Field label={t("client")} error={err.client_id?.message}>
        <NativeSelect {...form.register("client_id")}>
          {activeClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("phone")} hint={t("pasteHint")} error={err.phone?.message}>
        <PhoneInput
          country={dialCountry}
          onCountryChange={setDialCountry}
          countryLabel={t("countryCode")}
          autoFocus
          {...form.register("phone")}
          onPaste={onPaste}
        />
      </Field>
      {dupe && (
        <div role="status" className="bg-info-soft text-info flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
          <UserRoundSearch className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            {t("duplicate", { name: dupe.full_name || "—", when: f.relative(dupe.received_at, now || Date.now()) })}{" "}
            <StageBadge stage={dupe.stage} />{" "}
            <Link href={`/leads/${dupe.id}`} className="font-medium underline" onClick={onDone}>
              {t("openExisting")}
            </Link>
          </span>
        </div>
      )}
      <Field label={t("name")} error={err.full_name?.message}>
        <Input autoComplete="off" {...form.register("full_name")} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("subType")}</legend>
        <div className="flex flex-wrap gap-2">
          {SUB_TYPES.map((s) => (
            <label
              key={s}
              className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary cursor-pointer rounded-full border px-3 py-1.5 text-sm"
            >
              <input type="radio" value={s} className="sr-only" {...form.register("sub_type")} />
              {ts(s)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("note")}>
        <Textarea rows={2} {...form.register("note")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={create.isPending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
