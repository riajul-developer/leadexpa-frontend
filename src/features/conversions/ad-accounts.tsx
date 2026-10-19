"use client";

import { Link2, Pause, Play, RefreshCw, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/shared/hooks/use-format";
import { isApiError } from "@/shared/lib/api/errors";
import { useNow } from "@/shared/lib/sla";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { DialogModal } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { NativeSelect } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import {
  useAdAccountActions,
  useAdAccounts,
  useAvailableAccounts,
  useGoogle,
  useLinkAdAccount,
  type AdAccount,
  type Platform,
} from "./api";
import { HealthBadge, PLATFORM_NAME, PlatformIcon } from "./parts";

export function AdAccountsCard({ clientId, currency }: { clientId: string; currency: string }) {
  const t = useTranslations("spend");
  const q = useAdAccounts(clientId);
  const [linking, setLinking] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted text-sm">{t("hint", { currency })}</p>
        </div>
        <Button size="sm" onClick={() => setLinking(true)}>
          <Link2 aria-hidden />
          {t("link")}
        </Button>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !q.data?.data.length ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <ul className="grid gap-2">
            {q.data.data.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </CardContent>
      {linking && <LinkDialog clientId={clientId} currency={currency} onClose={() => setLinking(false)} />}
    </Card>
  );
}

function AccountRow({ a }: { a: AdAccount }) {
  const t = useTranslations("spend");
  const te = useTranslations("errors");
  const f = useFormat();
  const now = useNow();
  const { sync, status, unlink } = useAdAccountActions(a);
  const paused = a.status === "paused";
  return (
    <li className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <PlatformIcon platform={a.platform} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.name || a.external_id}</p>
        <p className="text-muted truncate text-xs">
          {PLATFORM_NAME[a.platform]} · <span dir="ltr">{a.external_id}</span> · {a.currency} ·{" "}
          {a.last_synced_at ? t("synced", { when: f.relative(a.last_synced_at, now || Date.now()) }) : t("neverSynced")}
        </p>
        {a.last_error && a.health !== "healthy" && <p className="text-danger text-xs">{a.last_error}</p>}
      </div>
      <HealthBadge health={a.health} paused={paused} />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("syncNow")}
        loading={sync.isPending}
        onClick={() =>
          sync.mutate(undefined, {
            onSuccess: () => toast.success(t("syncedToast")),
            onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : te("internal")),
          })
        }
      >
        <RefreshCw aria-hidden />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={paused ? t("resume") : t("pause")}
        onClick={() => status.mutate(paused ? "active" : "paused")}
      >
        {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("unlink")}
        onClick={() => window.confirm(t("unlinkConfirm")) && unlink.mutate()}
      >
        <Unlink aria-hidden />
      </Button>
    </li>
  );
}

function LinkDialog({ clientId, currency, onClose }: { clientId: string; currency: string; onClose: () => void }) {
  const t = useTranslations("spend.linkDialog");
  const te = useTranslations("errors");
  const [platform, setPlatform] = useState<Platform>("meta");
  const google = useGoogle(platform === "google_ads");
  const conns = (google.data?.connections ?? []).filter((c) => c.status === "active");
  const [conn, setConn] = useState("");
  const connectionId = platform === "google_ads" ? conn || conns[0]?.id : undefined;
  const avail = useAvailableAccounts(platform, connectionId);
  const [pick, setPick] = useState("");
  const link = useLinkAdAccount(clientId);
  const accounts = (avail.data?.data ?? []).filter((a) => !a.manager);
  const chosen = accounts.find((a) => a.external_id === pick) ?? accounts[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    link.mutate(
      { platform, external_id: chosen.external_id, connection_id: chosen.connection_id },
      {
        onSuccess: () => {
          toast.success(t("linked"));
          onClose();
        },
        onError: (err) => toast.error(isApiError(err) && te.has(err.code) ? te(err.code) : te("internal")),
      },
    );
  };

  return (
    <DialogModal open onOpenChange={(o) => !o && onClose()} title={t("title")} description={t("hint", { currency })}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label={t("platform")}>
          <NativeSelect
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value as Platform);
              setPick("");
            }}
          >
            <option value="meta">{PLATFORM_NAME.meta}</option>
            <option value="google_ads">{PLATFORM_NAME.google_ads}</option>
          </NativeSelect>
        </Field>
        {platform === "google_ads" && conns.length > 1 && (
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
        {avail.isPending && (platform === "meta" || connectionId) ? (
          <Skeleton className="h-10 w-full" />
        ) : accounts.length === 0 ? (
          <p className="text-muted text-sm">{t(platform === "meta" ? "noMeta" : "noGoogle")}</p>
        ) : (
          <Field label={t("account")}>
            <NativeSelect value={chosen?.external_id ?? ""} onChange={(e) => setPick(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.external_id} value={a.external_id}>
                  {(a.name || a.external_id) + " · " + a.currency}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {chosen && chosen.currency !== currency && (
          <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-sm" role="status">
            {t("currencyWarning", { account: chosen.currency, client: currency })}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={!chosen} loading={link.isPending}>
            {t("submit")}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
