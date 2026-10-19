"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ImageUp, Palette, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { track } from "@/shared/lib/analytics";
import { api, API_URL, CSRF_COOKIE, readCookie, unwrap } from "@/shared/lib/api/client";
import { isApiError, toApiError } from "@/shared/lib/api/errors";
import { useCan } from "@/shared/lib/session";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input, NativeSelect } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/shared/ui/primitives";

import { type Brand, BrandMarkOf, BrandTheme } from "./brand-theme";
import { CustomDomains, SenderDomains } from "./domain-settings";

const FONTS = ["system", "inter", "poppins", "hind_siliguri", "noto_sans", "noto_sans_arabic", "roboto"] as const;
const brandKey = ["brand"] as const;

// WCAG contrast: the same rule the API enforces.
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export function BrandingSettings() {
  const t = useTranslations("portal.branding");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const canEdit = useCan("agency.update");
  const q = useQuery({ queryKey: brandKey, queryFn: () => unwrap(api.GET("/v1/branding")) });
  const [v, setV] = useState({
    display_name: "",
    primary_color: "",
    accent_color: "",
    font: "system",
    support_email: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (q.data)
      setV({
        display_name: q.data.display_name === q.data.agency_name ? "" : q.data.display_name,
        primary_color: q.data.primary_color,
        accent_color: q.data.accent_color,
        font: q.data.font,
        support_email: q.data.support_email,
      });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT("/v1/branding", { body: { ...v, font: v.font as (typeof FONTS)[number] } })),
    meta: { silent: true },
    onSuccess: (b) => {
      track("branding.saved");
      qc.setQueryData(brandKey, b);
      toast.success(t("saved"));
    },
    onError: (e) => toast.error(isApiError(e) && Object.keys(e.fieldErrors).length ? t("checkFields") : t("failed")),
  });
  const upload = useMutation({
    // openapi-fetch only sends JSON: post multipart by hand (CSRF + idempotency).
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/v1/branding/logo`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": readCookie(CSRF_COOKIE) ?? "", "Idempotency-Key": crypto.randomUUID() },
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw toApiError(res, json);
      return json as Brand;
    },
    meta: { silent: true },
    onSuccess: (b) => qc.setQueryData(brandKey, b),
    onError: (e) => toast.error(isApiError(e) && te.has(e.code) ? te(e.code) : t("logoFailed")),
  });
  const removeLogo = useMutation({
    mutationFn: () => unwrap(api.DELETE("/v1/branding/logo")),
    onSuccess: (b) => qc.setQueryData(brandKey, b),
  });
  if (!q.data) return <Skeleton className="h-96 w-full" />;
  const portalUrl = `${typeof window === "undefined" ? "" : window.location.origin}/p/${q.data.slug}`;
  const ratio = isHex(v.primary_color) ? contrastWithWhite(v.primary_color.toLowerCase()) : null;
  const unreadable = ratio != null && ratio < 4.5;
  const preview: Brand = {
    ...q.data,
    display_name: v.display_name || q.data.agency_name,
    primary_color: isHex(v.primary_color) ? v.primary_color.toLowerCase() : "",
    primary_text: ratio != null && ratio >= 4.5 ? "#ffffff" : "#000000",
    accent_color: isHex(v.accent_color) ? v.accent_color.toLowerCase() : "",
    font: v.font,
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="text-accent size-5" aria-hidden />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <p className="text-muted text-sm">{t("hint")}</p>
            <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
              <Field label={t("name")} hint={t("nameHint", { agency: q.data.agency_name })}>
                <Input maxLength={80} value={v.display_name} onChange={set("display_name")} />
              </Field>
              <Field label={t("support")} hint={t("supportHint")}>
                <Input type="email" maxLength={254} value={v.support_email} onChange={set("support_email")} />
              </Field>
              <Field
                label={t("primary")}
                hint={ratio == null ? t("primaryHint") : t("contrast", { ratio: ratio.toFixed(1) })}
                error={unreadable ? t("unreadable") : undefined}
              >
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={t("primaryPicker")}
                    value={isHex(v.primary_color) ? v.primary_color : "#7a1a12"}
                    onChange={set("primary_color")}
                    className="border-border size-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <Input
                    value={v.primary_color}
                    placeholder="#1e3a8a"
                    maxLength={7}
                    onChange={set("primary_color")}
                    dir="ltr"
                  />
                </div>
              </Field>
              <Field label={t("accent")}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={t("accentPicker")}
                    value={isHex(v.accent_color) ? v.accent_color : "#a56f29"}
                    onChange={set("accent_color")}
                    className="border-border size-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <Input
                    value={v.accent_color}
                    placeholder="#f59e0b"
                    maxLength={7}
                    onChange={set("accent_color")}
                    dir="ltr"
                  />
                </div>
              </Field>
              <div className="flex flex-wrap items-end gap-3 sm:col-span-2 sm:flex-nowrap">
                <Field label={t("font")} className="w-full shrink-0 sm:w-52">
                  <NativeSelect value={v.font} onChange={set("font")}>
                    {FONTS.map((x) => (
                      <option key={x} value={x}>
                        {t(`fonts.${x}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {canEdit && (
                  <div className="flex min-w-0 flex-1 items-center gap-2 [&>*:not(span)]:shrink-0">
                    <input
                      ref={fileRef}
                      id="brand-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload.mutate(file);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    />
                    <Button asChild variant="secondary" loading={upload.isPending}>
                      <label htmlFor="brand-logo">
                        <ImageUp aria-hidden />
                        {t("logo")}
                      </label>
                    </Button>
                    {q.data.logo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        loading={removeLogo.isPending}
                        onClick={() => removeLogo.mutate()}
                      >
                        <Trash2 aria-hidden />
                        {t("removeLogo")}
                      </Button>
                    )}
                    <span className="text-muted min-w-0 text-xs">{t("logoHint")}</span>
                  </div>
                )}
              </div>
            </fieldset>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" disabled={unreadable} loading={save.isPending}>
                  {t("save")}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("preview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="border-border overflow-hidden rounded-xl border" data-testid="brand-preview">
            <BrandTheme brand={preview} className="">
              <div className="grid min-h-0 gap-3 p-4">
                <div aria-hidden className="h-1 rounded-full [background:var(--brand-rule)]" />
                <BrandMarkOf brand={preview} className="h-10 w-auto" />
                <p className="text-lg font-semibold">{t("previewHeading", { brand: preview.display_name })}</p>
                <div className="flex gap-2">
                  <Button size="sm">{t("previewButton")}</Button>
                  <span className="text-accent self-center text-sm font-medium">{t("previewAccent")}</span>
                </div>
              </div>
            </BrandTheme>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t("portalLink")}</span>
            <code dir="ltr" className="bg-surface-2 rounded px-2 py-1 text-xs break-all">
              {portalUrl}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigator.clipboard
                  .writeText(portalUrl)
                  .then(() => toast.success(t("copied")))
                  .catch(() => toast.success(portalUrl))
              }
            >
              <Copy aria-hidden />
              {t("copy")}
            </Button>
          </div>
          <p className="text-muted text-xs">{t("portalHint")}</p>
        </CardContent>
      </Card>

      <CustomDomains />
      <SenderDomains />
    </div>
  );
}
