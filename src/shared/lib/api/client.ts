import createClient, { type Middleware } from "openapi-fetch";

import { isCustomHost } from "../hosts";
import { setServerOffset } from "../server-time";

import { ApiError, toApiError } from "./errors";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

// On a custom portal domain the API is served same-origin.
export const API_URL =
  typeof window !== "undefined" && isCustomHost(window.location.host)
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080");
export const CSRF_COOKIE = "recov_csrf";

let base = API_URL;
export function apiBase(): string {
  return base;
}
export function setApiBase(url: string | null | undefined) {
  if (!url || !/^https?:\/\//.test(url)) return;
  if (typeof window !== "undefined" && isCustomHost(window.location.host)) return;
  base = url.replace(/\/$/, "");
}

async function followRegion(res: Response) {
  if (res.status !== 421 || typeof window === "undefined") return;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { region?: { app_url?: string } } | null;
  const app = body?.region?.app_url;
  if (app && /^https?:\/\//.test(app) && !app.startsWith(window.location.origin)) {
    window.location.assign(app.replace(/\/$/, "") + window.location.pathname + window.location.search);
  }
}
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

// One refresh at a time: concurrent 401s wait for the same refresh call.
let refreshing: Promise<string | null> | null = null;
function refreshSession(): Promise<string | null> {
  refreshing ??= fetch(`${base}/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": readCookie(CSRF_COOKIE) ?? "" },
  })
    .then(async (r) =>
      r.ok ? null : (((await r.json().catch(() => null)) as { code?: string } | null)?.code ?? "unauthenticated"),
    )
    .catch(() => "network")
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export type SessionListener = (reason?: string) => void;
const sessionLost = new Set<SessionListener>();
export function onSessionLost(fn: SessionListener): () => void {
  sessionLost.add(fn);
  return () => sessionLost.delete(fn);
}

async function fetchWithRefresh(input: Request): Promise<Response> {
  const retry = input.clone();
  const res = await fetch(input);
  await followRegion(res);
  if (res.status !== 401 || input.url.includes("/v1/auth/")) return res;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { code?: string } | null;
  if (body?.code !== "session_expired") {
    sessionLost.forEach((fn) => fn(body?.code));
    return res;
  }
  const lost = await refreshSession();
  if (lost) {
    sessionLost.forEach((fn) => fn(lost));
    return res;
  }
  // The CSRF cookie rotates on refresh: re-read it for the retry.
  if (UNSAFE.has(retry.method)) retry.headers.set("X-CSRF-Token", readCookie(CSRF_COOKIE) ?? "");
  return fetch(retry);
}

const conventions: Middleware = {
  onRequest({ request }) {
    if (base !== API_URL && request.url.startsWith(API_URL)) {
      request = new Request(base + request.url.slice(API_URL.length), request);
    }
    if (UNSAFE.has(request.method)) {
      request.headers.set("X-CSRF-Token", readCookie(CSRF_COOKIE) ?? "");
      if (request.method === "POST" && !request.headers.has("Idempotency-Key")) {
        request.headers.set("Idempotency-Key", crypto.randomUUID());
      }
    }
    return request;
  },
  onResponse({ response }) {
    const date = response.headers.get("Date");
    if (date) setServerOffset(Date.parse(date) - Date.now());
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: API_URL, credentials: "include", fetch: fetchWithRefresh });
api.use(conventions);

export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<NonNullable<T>> {
  const { data, error, response } = await call;
  if (error !== undefined || !response.ok) throw toApiError(response, error);
  return data as NonNullable<T>;
}

export async function unwrapEmpty(call: Promise<{ error?: unknown; response: Response }>): Promise<void> {
  const { error, response } = await call;
  if (error !== undefined || !response.ok) throw toApiError(response, error);
}

export { ApiError };
