"use client";

import { Building, Network, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { useMe } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import { useCreateGroup, useMyGroups } from "../api";

export function GroupsPage() {
  const t = useTranslations("groups");
  const q = useMyGroups();
  const { data: me } = useMe();
  const isOwner = me?.membership?.role === "owner";
  const rows = q.data?.data ?? [];
  return (
    <div className="mx-auto grid max-w-4xl gap-4 p-4">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted text-sm">{t("hint")}</p>
      </div>
      {q.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Network} title={t("emptyTitle")} description={t("emptyHint")} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="groups">
          {rows.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="block">
                <Card className="hover:border-primary flex items-center gap-3 p-4 transition-colors">
                  <Building className="text-accent size-6 shrink-0" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium">{g.name}</span>
                    <span className="text-muted text-xs">{g.reporting_currency}</span>
                  </span>
                  <Badge className="ms-auto" tone={g.my_role === "owner" ? "info" : "neutral"}>
                    {t(`roles.${g.my_role}`)}
                  </Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isOwner && <CreateGroup />}
    </div>
  );
}

function CreateGroup() {
  const t = useTranslations("groups.create");
  const create = useCreateGroup();
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return setError(t("nameRequired"));
            setError(undefined);
            create.mutate(
              { name: name.trim(), ...(currency.trim() ? { reporting_currency: currency.trim().toUpperCase() } : {}) },
              {
                onSuccess: (g) => {
                  track("groups.group.created");
                  router.push(`/groups/${g.id}`);
                },
                onError: (e) =>
                  setError(
                    !isApiError(e)
                      ? t("failed")
                      : e.code === "plan_limit"
                        ? t("plan")
                        : e.code === "agency_in_group"
                          ? t("alreadyInGroup")
                          : t("failed"),
                  ),
              },
            );
          }}
        >
          <p className="text-muted text-sm">{t("hint")}</p>
          {error && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("name")} className="min-w-60 flex-1">
              <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("currency")} hint={t("currencyHint")} className="w-36">
              <Input value={currency} maxLength={3} dir="ltr" onChange={(e) => setCurrency(e.target.value)} />
            </Field>
            <Button type="submit" loading={create.isPending}>
              {t("submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
