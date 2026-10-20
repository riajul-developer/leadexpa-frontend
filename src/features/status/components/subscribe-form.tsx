"use client";

import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/controls";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

import { postSubscription } from "../api";

/** Email updates for incidents and maintenance (ADR 0061): double opt-in, in the page's language. */
export function SubscribeForm({ regions }: { regions: string[] }) {
  const t = useTranslations("serviceStatus.subscribe");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string>();
  return (
    <section className="border-border bg-surface grid gap-3 rounded-xl border p-4" aria-labelledby="subscribe-h">
      <h2 id="subscribe-h" className="text-lg font-semibold">
        {t("title")}
      </h2>
      {state === "sent" ? (
        <p role="status" className="bg-success-soft text-success flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
          <MailCheck className="size-4 shrink-0" aria-hidden />
          {t("sent", { email })}
        </p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            setState("sending");
            postSubscription("", { email: email.trim(), locale, regions: picked })
              .then((r) => {
                if (r.status === 202) return setState("sent");
                setState("idle");
                setError(
                  r.code === "invalid_email"
                    ? t("errors.email")
                    : r.code === "rate_limited"
                      ? t("errors.rate")
                      : t("errors.failed"),
                );
              })
              .catch(() => {
                setState("idle");
                setError(t("errors.failed"));
              });
          }}
        >
          <p className="text-muted text-sm">{t("hint")}</p>
          <Field label={t("email")}>
            <Input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {regions.length > 1 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("regions")}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {regions.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.includes(r)}
                      onCheckedChange={(on) =>
                        setPicked((old) => (on === true ? [...old, r] : old.filter((x) => x !== r)))
                      }
                    />
                    <span dir="ltr">{r}</span>
                  </label>
                ))}
              </div>
              <p className="text-muted text-xs">{t("regionsHint")}</p>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" loading={state === "sending"}>
              {t("submit")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
