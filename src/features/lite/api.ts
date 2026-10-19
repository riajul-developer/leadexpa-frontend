// Plain fetch keeps the lite app small: no query client or openapi-fetch runtime.
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

export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function localePath(locale: string, path: string): string {
  return path.startsWith(`/${locale}/`) || path === `/${locale}` ? path : `/${locale}${path}`;
}

// Local helpers: the shared formatter module is too heavy for the lite app.
export const telHref = (e164: string) => `tel:${e164}`;
export const whatsappHref = (e164: string) => `https://wa.me/${e164.replace(/\D/g, "")}`;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function ago(iso: string, locale: string): string {
  const secs = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  for (const [unit, size] of UNITS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return rtf.format(0, "minute");
}
