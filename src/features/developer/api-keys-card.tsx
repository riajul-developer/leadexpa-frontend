"use client";

import { KeyRound, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useMembers } from "@/shared/lib/lookups";
import { useNow } from "@/shared/lib/sla";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Checkbox, Dialog, DialogContent } from "@/shared/ui/overlays";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { type ApiKey, type ApiScope, useApiKeys, useCreateApiKey, useDeveloperCatalog, useRevokeApiKey } from "./api";
import { KeyStatusBadge, SecretOnce } from "./parts";

const EXPIRY_DAYS = [0, 30, 90, 365] as const;

export function ApiKeysCard() {
  const t = useTranslations("developer.keys");
  const { data, isPending } = useApiKeys();
  const [open, setOpen] = useState(false);
  const keys = data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="text-accent size-4" aria-hidden />
            {t("title")}
          </CardTitle>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : keys.length === 0 ? (
          <EmptyState icon={KeyRound} title={t("emptyTitle")} description={t("emptyHint")} className="py-8" />
        ) : (
          <ul className="divide-border grid divide-y">
            {keys.map((k) => (
              <KeyRow key={k.id} apiKey={k} />
            ))}
          </ul>
        )}
      </CardContent>
      {open && <NewKeyDialog onClose={() => setOpen(false)} />}
    </Card>
  );
}

function KeyRow({ apiKey: k }: { apiKey: ApiKey }) {
  const t = useTranslations("developer.keys");
  const f = useFormat();
  const now = useNow();
  const { byUserId } = useMembers();
  const revoke = useRevokeApiKey();
  const creator = byUserId.get(k.created_by)?.user.name;
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{k.name}</span>
          <code className="text-muted text-xs" dir="ltr">
            rkp.…{k.hint}
          </code>
          <KeyStatusBadge status={k.status} />
        </p>
        <p className="flex flex-wrap gap-1">
          {k.scopes.map((s) => (
            <Badge key={s} tone="primary" dir="ltr">
              {s}
            </Badge>
          ))}
        </p>
        <p className="text-muted text-xs">
          {t("meta", {
            creator: creator ?? t("someone"),
            used: k.last_used_at ? f.relative(k.last_used_at, now || Date.now()) : t("neverUsed"),
          })}
          {k.expires_at && ` · ${t("expires", { when: f.relative(k.expires_at, now || Date.now()) })}`}
        </p>
      </div>
      {k.status === "active" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-danger"
          loading={revoke.isPending}
          onClick={() => window.confirm(t("revokeConfirm", { name: k.name })) && revoke.mutate(k.id)}
        >
          {t("revoke")}
        </Button>
      )}
    </li>
  );
}

function NewKeyDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("developer.keys");
  const ts = useTranslations("developer.scopes");
  const { data: catalog } = useDeveloperCatalog();
  const create = useCreateApiKey();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [expiry, setExpiry] = useState<(typeof EXPIRY_DAYS)[number]>(0);
  const [error, setError] = useState<string | null>(null);
  const created = create.data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const expires_at = expiry ? new Date(Date.now() + expiry * 86_400_000).toISOString() : null;
    create.mutate(
      { name: name.trim(), scopes, expires_at },
      { onError: (err) => setError(isApiError(err) ? err.message : t("failed")) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={created ? t("createdTitle") : t("new")} description={created ? undefined : t("newHint")}>
        {created ? (
          <SecretOnce label={t("secretLabel")} value={created.secret}>
            <div className="grid gap-1">
              <span className="text-muted text-xs font-medium">{t("example")}</span>
              <pre className="bg-surface-2 overflow-x-auto rounded-lg p-2 text-xs" dir="ltr">
                {`curl ${process.env.NEXT_PUBLIC_API_URL ?? "https://api.leadexpa.com"}/v1/leads \\\n  -H "Authorization: Bearer ${created.secret.slice(0, 12)}…"`}
              </pre>
            </div>
            <Button onClick={onClose}>{t("done")}</Button>
          </SecretOnce>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <Field label={t("name")} hint={t("nameHint")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("scopes")}</legend>
              {(catalog?.scopes ?? []).map(({ scope }) => {
                const id = `scope-${scope}`;
                return (
                  <label
                    key={scope}
                    htmlFor={id}
                    className="border-border hover:bg-surface-2 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={scopes.includes(scope)}
                      onCheckedChange={(on) =>
                        setScopes((cur) => (on ? [...cur, scope] : cur.filter((s) => s !== scope)))
                      }
                    />
                    <span className="grid gap-0.5">
                      <code className="text-sm font-medium" dir="ltr">
                        {scope}
                      </code>
                      <span className="text-muted text-xs">{ts(scope.replace(":", "_"))}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("expiry")}</legend>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_DAYS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={expiry === d ? "primary" : "secondary"}
                    aria-pressed={expiry === d}
                    onClick={() => setExpiry(d)}
                  >
                    {d ? t("days", { n: d }) : t("never")}
                  </Button>
                ))}
              </div>
            </fieldset>
            <p className="text-muted text-xs">{t("actsAs")}</p>
            {error && (
              <p className="text-danger text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={create.isPending} disabled={!name.trim() || scopes.length === 0}>
                {t("create")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
