// Plain fetch for the lite app (FRONTEND_PROMPT 17.0.3): no query client, no openapi-fetch runtime, so the
// whole app stays small on a cheap phone. Same session cookies and CSRF double-submit as the main app.
import type { components } from "@/shared/lib/api/schema";

export type Schemas = components["schemas"];

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class LiteError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(code);
  }
}

function csrf(): string {
  const m = typeof document === "undefined" ? null : document.cookie.match(/(?:^|; )recov_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : "";
}

async function once(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrf();
  return fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
  });
}

/** Calls the API; refreshes the session once when the access token expired. */
export async function lite<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await once(method, path, body);
  if (res.status === 401 && path !== "/v1/auth/refresh") {
    const peek = (await res
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;
    if (peek?.code === "session_expired" && (await once("POST", "/v1/auth/refresh")).ok) {
      res = await once(method, path, body);
    }
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (T & { code?: string; retry_after_seconds?: number }) | null;
  if (!res.ok) throw new LiteError(res.status, data?.code ?? "internal", data?.retry_after_seconds);
  return data as T;
}

/** The device's IANA timezone; the API reads a local phone number in that country. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** "/lite" → "/bn/lite" (plain next/link and router, without next-intl's navigation runtime). */
export function localePath(locale: string, path: string): string {
  return path.startsWith(`/${locale}/`) || path === `/${locale}` ? path : `/${locale}${path}`;
}

// Tiny local helpers instead of the shared formatter module (it carries every number/date format the main app
// uses; the lite app needs four lines of it).
export const telHref = (e164: string) => `tel:${e164}`;
export const whatsappHref = (e164: string) => `https://wa.me/${e164.replace(/\D/g, "")}`;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "5 min ago" in the UI language. */
export function ago(iso: string, locale: string): string {
  const secs = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  for (const [unit, size] of UNITS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return rtf.format(0, "minute");
}
