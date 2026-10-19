"use client";

import { Code2, Megaphone, Webhook, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { isApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/cn";
import { useClients } from "@/shared/lib/lookups";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { DialogModal } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/primitives";

import {
  useConnectorCatalog,
  useCreateConnectorInstall,
  type ConnectorCredentials,
  type ConnectorInstall,
} from "./api";
import { CredentialsPanel } from "./parts";

const ICON: Record<string, LucideIcon> = { ads: Megaphone, forms: Webhook, developer: Code2 };

export function AddConnectorDialog({ clientId, onClose }: { clientId?: string; onClose: () => void }) {
  const t = useTranslations("connectors.add");
  const te = useTranslations("errors");
  const catalog = useConnectorCatalog();
  const { clients } = useClients();
  const active = clients.filter((c) => c.status === "active");
  const [connector, setConnector] = useState("");
  const [client, setClient] = useState(clientId ?? "");
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ install: ConnectorInstall; credentials: ConnectorCredentials } | null>(null);
  const create = useCreateConnectorInstall();
  const chosenClient = client || active[0]?.id || "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connector || !chosenClient) return;
    create.mutate(
      { connector, client_id: chosenClient, name: name.trim() || undefined },
      {
        onSuccess: setDone,
        onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : te("internal")),
      },
    );
  };

  return (
    <DialogModal
      open
      onOpenChange={(o) => !o && onClose()}
      title={done ? t("readyTitle", { name: done.install.name }) : t("title")}
      description={done ? undefined : t("hint")}
      className="max-w-xl"
    >
      {done ? (
        <div className="grid gap-4">
          <CredentialsPanel connector={done.install.connector} credentials={done.credentials} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/integrations/sources/${done.install.id}`}>{t("openHealth")}</Link>
            </Button>
            <Button onClick={onClose}>{t("done")}</Button>
          </div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          {catalog.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("connector")}</legend>
              {catalog.data?.data.map((m) => {
                const Icon = ICON[m.category] ?? Webhook;
                return (
                  <label
                    key={m.key}
                    className={cn(
                      "border-border hover:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                      connector === m.key && "border-primary bg-primary-soft",
                    )}
                  >
                    <input
                      type="radio"
                      name="connector"
                      value={m.key}
                      checked={connector === m.key}
                      onChange={() => setConnector(m.key)}
                      className="mt-1"
                    />
                    <Icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
                    <span className="grid gap-0.5">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted text-sm">
                        {t.has(`about.${m.key}`) ? t(`about.${m.key}`) : t(`category.${m.category}`)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
          {!clientId && (
            <Field label={t("client")}>
              <NativeSelect value={chosenClient} onChange={(e) => setClient(e.target.value)} required>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label={t("name")} hint={t("nameHint")}>
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!connector || !chosenClient} loading={create.isPending}>
              {t("submit")}
            </Button>
          </div>
        </form>
      )}
    </DialogModal>
  );
}
