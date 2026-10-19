"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { DialogModal } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";

import {
  triggerKey,
  useCreateDestination,
  useGoogle,
  useGoogleActions,
  useGoogleCustomers,
  type NewDestination,
  type Platform,
} from "./api";
import { PLATFORM_NAME, PlatformIcon } from "./parts";

const GOOGLE_TRIGGERS = ["stage.qualified", "stage.won", "sale"] as const;

export function AddDestinationDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const t = useTranslations("conversions.addDialog");
  const tc = useTranslations("conversions");
  const te = useTranslations("errors");
  const [platform, setPlatform] = useState<Platform>("meta");
  const [name, setName] = useState("");
  const [dataset, setDataset] = useState("");
  const [token, setToken] = useState("");
  const [testCode, setTestCode] = useState("");
  const google = useGoogle(platform === "google_ads");
  const conns = (google.data?.connections ?? []).filter((c) => c.status === "active");
  const [conn, setConn] = useState("");
  const connectionId = conn || conns[0]?.id;
  const customers = useGoogleCustomers(platform === "google_ads" ? connectionId : undefined);
  const [customer, setCustomer] = useState("");
  const [login, setLogin] = useState("");
  const actions = useGoogleActions(connectionId, customer, login);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const create = useCreateDestination(clientId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: NewDestination =
      platform === "meta"
        ? {
            platform,
            name: name.trim() || undefined,
            dataset_id: dataset.trim(),
            access_token: token.trim(),
            test_event_code: testCode.trim() || undefined,
          }
        : {
            platform,
            name: name.trim() || undefined,
            google_connection_id: connectionId,
            customer_id: customer,
            login_customer_id: login || undefined,
            mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)),
          };
    create.mutate(body, {
      onSuccess: () => {
        toast.success(t("created"));
        onClose();
      },
      onError: (err) =>
        toast.error(
          isApiError(err) && err.status === 422
            ? te("validation_failed")
            : isApiError(err) && te.has(err.code)
              ? te(err.code)
              : te("internal"),
        ),
    });
  };

  const googleReady = platform === "google_ads" && !!connectionId && customer.replace(/-/g, "").length === 10;
  const metaReady = platform === "meta" && dataset.trim() !== "" && token.trim().length >= 20;

  return (
    <DialogModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("title")}
      description={t("hint")}
      className="max-w-xl"
    >
      <form className="grid gap-4" onSubmit={submit}>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-sm font-medium">{t("platform")}</legend>
          {(["meta", "google_ads"] as const).map((p) => (
            <label
              key={p}
              className={cn(
                "border-border flex cursor-pointer items-center gap-2 rounded-lg border p-3",
                platform === p && "border-primary bg-primary-soft",
              )}
            >
              <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} />
              <PlatformIcon platform={p} />
              <span className="font-medium">{PLATFORM_NAME[p]}</span>
            </label>
          ))}
        </fieldset>
        <Field label={t("name")} hint={t("nameHint")}>
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>

        {platform === "meta" ? (
          <>
            <Field label={t("dataset")} hint={t("datasetHint")}>
              <Input
                value={dataset}
                inputMode="numeric"
                onChange={(e) => setDataset(e.target.value)}
                dir="ltr"
                required
              />
            </Field>
            <Field label={t("token")} hint={t("tokenHint")}>
              <Input
                type="password"
                value={token}
                autoComplete="off"
                onChange={(e) => setToken(e.target.value)}
                dir="ltr"
                required
              />
            </Field>
            <Field label={tc("testEventCode")} hint={tc("testEventCodeHint")}>
              <Input value={testCode} maxLength={40} onChange={(e) => setTestCode(e.target.value)} dir="ltr" />
            </Field>
            <p className="text-muted text-sm">{t("metaMapping")}</p>
          </>
        ) : !google.data?.configured && !google.isPending ? (
          <p className="text-muted text-sm">{t("googleUnconfigured")}</p>
        ) : conns.length === 0 && !google.isPending ? (
          <p className="text-sm">
            {t("googleConnectFirst")}{" "}
            <Link href="/integrations" className="text-primary underline">
              {t("openIntegrations")}
            </Link>
          </p>
        ) : (
          <>
            {conns.length > 1 && (
              <Field label={t("googleAccount")}>
                <NativeSelect value={connectionId ?? ""} onChange={(e) => setConn(e.target.value)}>
                  {conns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.email}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label={t("customer")} hint={t("customerHint")}>
              <Input
                value={customer}
                list="google-customers"
                placeholder="123-456-7890"
                onChange={(e) => setCustomer(e.target.value)}
                dir="ltr"
                required
              />
            </Field>
            <datalist id="google-customers">
              {(customers.data?.data ?? [])
                .filter((c) => !c.manager)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </datalist>
            <Field label={t("login")} hint={t("loginHint")}>
              <NativeSelect value={login} onChange={(e) => setLogin(e.target.value)}>
                <option value="">{t("noManager")}</option>
                {(customers.data?.data ?? [])
                  .filter((c) => c.manager)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.id}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            {googleReady && (
              <div className="grid gap-2 sm:grid-cols-3">
                {GOOGLE_TRIGGERS.map((tr) => (
                  <Field key={tr} label={tc(`trigger.${triggerKey(tr)}`)}>
                    <NativeSelect
                      value={mapping[tr] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [tr]: e.target.value })}
                    >
                      <option value="">{tc("notSent")}</option>
                      {(actions.data?.data ?? []).map((a) => (
                        <option key={a.resource_name} value={a.resource_name}>
                          {a.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={!(metaReady || googleReady)} loading={create.isPending}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
