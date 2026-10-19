"use client";

import { Building2, KeyRound, Trash2, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/shared/hooks/use-format";
import { track } from "@/shared/lib/analytics";
import { isApiError } from "@/shared/lib/api/errors";
import { useDisplayTimeZone } from "@/shared/lib/preferences";
import { useMe } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/shared/ui/primitives";

import {
  type HoldingGroupDetail,
  type HoldingGroupInviteCreated,
  type HoldingGroupReportLine,
  useEligibleMembers,
  useGroup,
  useGroupActions,
  useGroupReport,
} from "../api";

/** YYYY-MM-DD in a time zone: the report uses each agency's local dates. */
function isoDay(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    d,
  );
}

export function GroupPage({ id }: { id: string }) {
  const t = useTranslations("groups");
  const q = useGroup(id);
  if (q.isPending) return <Skeleton className="m-4 h-96" />;
  if (q.isError || !q.data) {
    return (
      <Card className="m-4">
        <EmptyState title={t("notFound")} description={t("notFoundHint")} />
      </Card>
    );
  }
  const g = q.data;
  const owner = g.my_role === "owner";
  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{g.name}</h1>
        <Badge tone={owner ? "info" : "neutral"}>{t(`roles.${g.my_role}`)}</Badge>
      </div>
      <GroupReport group={g} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Agencies group={g} />
        <People group={g} />
      </div>
      {owner && <Invites group={g} />}
      {owner && <Manage group={g} />}
    </div>
  );
}

function GroupReport({ group }: { group: HoldingGroupDetail }) {
  const t = useTranslations("groups.report");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const [to, setTo] = useState(() => isoDay(new Date(), tz));
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86_400_000), tz));
  const q = useGroupReport(group.id, from, to);
  const money = (minor: number) => fmt.money({ amount_minor: minor, currency: group.reporting_currency });
  const pct = (v: number | null | undefined) => (v == null ? "—" : fmt.percent(v));
  const total = q.data?.total;
  const line = (l: HoldingGroupReportLine, isTotal = false) => (
    <tr key={l.agency_id ?? "total"} className={isTotal ? "font-semibold" : undefined}>
      <th scope="row" className="py-2 pe-3 text-start font-medium">
        {isTotal ? t("total") : l.name}
      </th>
      <td className="px-3 py-2 text-end tabular-nums">{fmt.number(l.leads_received)}</td>
      <td className="px-3 py-2 text-end tabular-nums">{pct(l.contact_rate)}</td>
      <td className="px-3 py-2 text-end tabular-nums">{pct(l.sla_compliance)}</td>
      <td className="px-3 py-2 text-end tabular-nums">
        {l.speed_to_lead_median_seconds == null ? "—" : fmt.duration(l.speed_to_lead_median_seconds)}
      </td>
      <td className="px-3 py-2 text-end tabular-nums">{fmt.number(l.leads_won)}</td>
      <td className="px-3 py-2 text-end tabular-nums">{pct(l.win_rate)}</td>
      <td className="px-3 py-2 text-end tabular-nums">{money(l.revenue_minor)}</td>
    </tr>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("from")}>
            <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </Field>
          <Field label={t("to")}>
            <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </Field>
          <p className="text-muted text-xs">{t("datesHint")}</p>
        </div>
        {q.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : q.isError || !q.data || !total ? (
          <p role="alert" className="text-danger text-sm">
            {t("failed")}
          </p>
        ) : q.data.agencies.length === 0 ? (
          <EmptyState icon={Building2} title={t("noAgencies")} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="group-kpis">
              <KpiCard label={t("leads")} value={fmt.number(total.leads_received)} />
              <KpiCard label={t("sla")} value={pct(total.sla_compliance)} />
              <KpiCard label={t("winRate")} value={pct(total.win_rate)} />
              <KpiCard label={t("revenue")} value={money(total.revenue_minor)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm" data-testid="group-report">
                <caption className="sr-only">{t("tableCaption")}</caption>
                <thead className="text-muted text-xs">
                  <tr>
                    <th scope="col" className="py-2 pe-3 text-start font-medium">
                      {t("agency")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("leads")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("contactRate")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("sla")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("speed")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("won")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("winRate")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("revenue")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {q.data.agencies.map((l) => line(l))}
                  {line(total, true)}
                </tbody>
              </table>
            </div>
            <p className="text-muted text-xs">{t("speedHint")}</p>
            {total.missing_currencies.length > 0 && (
              <p className="text-warning text-xs">{t("missingRates", { list: total.missing_currencies.join(", ") })}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Agencies({ group }: { group: HoldingGroupDetail }) {
  const t = useTranslations("groups.agencies");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { removeAgency } = useGroupActions(group.id);
  const owner = group.my_role === "owner";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-border grid divide-y" data-testid="group-agencies">
          {group.agencies.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="grid gap-0.5">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted text-xs">
                  {t("joined", { when: fmt.dateTime(a.joined_at, tz, "date") })}
                </span>
              </span>
              {owner && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  aria-label={t("remove", { name: a.name })}
                  onClick={() => {
                    if (window.confirm(t("removeConfirm", { name: a.name }))) removeAgency.mutate(a.id);
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function People({ group }: { group: HoldingGroupDetail }) {
  const t = useTranslations("groups.people");
  const tr = useTranslations("groups.roles");
  const owner = group.my_role === "owner";
  const { data: me } = useMe();
  const { setMember, removeMember } = useGroupActions(group.id);
  const eligible = useEligibleMembers(group.id, owner);
  const [pick, setPick] = useState("");
  const fail = (e: unknown) =>
    toast.error(
      isApiError(e) && e.code === "group_last_owner"
        ? t("lastOwner")
        : isApiError(e) && e.code === "group_member_not_eligible"
          ? t("notEligible")
          : t("failed"),
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-border grid divide-y" data-testid="group-people">
          {group.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{m.name}</span>
                {m.email && (
                  <span dir="ltr" className="text-muted truncate text-xs">
                    {m.email}
                  </span>
                )}
              </span>
              <span className="ms-auto flex items-center gap-1">
                {owner ? (
                  <NativeSelect
                    aria-label={t("roleFor", { name: m.name })}
                    className="w-32"
                    value={m.role}
                    onChange={(e) =>
                      setMember.mutate(
                        { userId: m.user_id, role: e.target.value as "owner" | "analyst" },
                        { onError: fail },
                      )
                    }
                  >
                    <option value="owner">{tr("owner")}</option>
                    <option value="analyst">{tr("analyst")}</option>
                  </NativeSelect>
                ) : (
                  <Badge tone="neutral">{tr(m.role)}</Badge>
                )}
                {(owner || m.user_id === me?.user.id) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("remove", { name: m.name })}
                    onClick={() => {
                      if (window.confirm(t("removeConfirm", { name: m.name })))
                        removeMember.mutate(m.user_id, { onError: fail });
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {owner && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pick) return;
              setMember.mutate(
                { userId: pick, role: "analyst" },
                {
                  onSuccess: () => {
                    track("groups.member.added");
                    setPick("");
                    toast.success(t("added"));
                  },
                  onError: fail,
                },
              );
            }}
          >
            <Field label={t("add")} hint={t("addHint")} className="min-w-60 flex-1">
              <NativeSelect value={pick} onChange={(e) => setPick(e.target.value)} disabled={eligible.isPending}>
                <option value="">{t("choose")}</option>
                {(eligible.data?.data ?? []).map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {t("eligibleOption", { name: p.name, agencies: p.agencies.join(", ") })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="secondary" disabled={!pick} loading={setMember.isPending}>
              <UserPlus aria-hidden />
              {t("addButton")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Invites({ group }: { group: HoldingGroupDetail }) {
  const t = useTranslations("groups.invites");
  const fmt = useFormat();
  const tz = useDisplayTimeZone();
  const { invite, revokeInvite } = useGroupActions(group.id);
  const [created, setCreated] = useState<HoldingGroupInviteCreated | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="text-accent size-5" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted text-sm">{t("hint")}</p>
        <div>
          <Button
            variant="secondary"
            loading={invite.isPending}
            onClick={() =>
              invite.mutate(undefined, {
                onSuccess: (r) => {
                  track("groups.invite.created");
                  setCreated(r);
                },
              })
            }
          >
            {t("create")}
          </Button>
        </div>
        {created && (
          <div
            className="border-primary bg-primary-soft grid gap-2 rounded-lg border p-3"
            data-testid="group-invite-created"
          >
            <p className="text-sm font-medium">{t("shownOnce")}</p>
            <code dir="ltr" className="font-mono text-xs break-all">
              {created.code}
            </code>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(created.code)
                    .then(() => toast.success(t("copied")))
                    .catch(() => undefined)
                    .finally(() => setCreated(null))
                }
              >
                {t("copyClose")}
              </Button>
            </div>
          </div>
        )}
        {group.invites.length > 0 && (
          <ul className="divide-border grid divide-y" data-testid="group-invites">
            {group.invites.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                <span>{t("expires", { when: fmt.dateTime(i.expires_at, tz) })}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  aria-label={t("revoke")}
                  onClick={() => revokeInvite.mutate(i.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Manage({ group }: { group: HoldingGroupDetail }) {
  const t = useTranslations("groups.manage");
  const router = useRouter();
  const { update, disband } = useGroupActions(group.id);
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.reporting_currency);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { name: name.trim(), reporting_currency: currency.trim().toUpperCase() },
              { onSuccess: () => toast.success(t("saved")), onError: () => toast.error(t("failed")) },
            );
          }}
        >
          <Field label={t("name")} className="min-w-60 flex-1">
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("currency")} className="w-28">
            <Input value={currency} maxLength={3} dir="ltr" onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Button type="submit" loading={update.isPending}>
            {t("save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="ms-auto"
            loading={disband.isPending}
            onClick={() => {
              if (!window.confirm(t("disbandConfirm", { name: group.name }))) return;
              disband.mutate(undefined, {
                onSuccess: () => {
                  track("groups.group.disbanded");
                  router.push("/groups");
                },
              });
            }}
          >
            <Trash2 aria-hidden />
            {t("disband")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
