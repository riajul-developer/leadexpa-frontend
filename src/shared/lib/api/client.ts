import createClient, { type Middleware } from "openapi-fetch";

import { isCustomHost } from "../hosts";
import { setServerOffset } from "../server-time";

import { ApiError, toApiError } from "./errors";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

// On an agency's custom portal domain the TLS proxy serves the API same-origin (/v1 on that host).
export const API_URL =
  typeof window !== "undefined" && isCustomHost(window.location.host)
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080");
export const CSRF_COOKIE = "recov_csrf";

// Multi-region (G1): /v1/me says which cell serves the active agency. NEXT_PUBLIC_API_URL only bootstraps;
// after that every call goes to the agency's region.
let base = API_URL;
export function apiBase(): string {
  return base;
}
/** Points the client at the agency's region (from /v1/me api_base_url). Ignored on custom portal hosts. */
export function setApiBase(url: string | null | undefined) {
  if (!url || !/^https?:\/\//.test(url)) return;
  if (typeof window !== "undefined" && isCustomHost(window.location.host)) return;
  base = url.replace(/\/$/, "");
}

/** A 421 wrong_region answer: the agency lives in another region. Continue there, on the same page. */
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
// Resolves to null on success, or why the session is gone ("session_policy" when the agency's limits ended it).
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

/** reason: the API code that ended the session (e.g. "session_policy"), when it said one. */
export type SessionListener = (reason?: string) => void;
const sessionLost = new Set<SessionListener>();
/** Called when the session can't be refreshed (the app shell redirects to login, keeping returnTo). */
export function onSessionLost(fn: SessionListener): () => void {
  sessionLost.add(fn);
  return () => sessionLost.delete(fn);
}

/** fetch with one silent refresh on `401 session_expired`, retrying the original request once. */
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

/**
 * Unwraps an openapi-fetch result: returns data or throws a typed ApiError. Use in every query/mutation fn
 * so React Query sees failures as errors.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<NonNullable<T>> {
  const { data, error, response } = await call;
  if (error !== undefined || !response.ok) throw toApiError(response, error);
  return data as NonNullable<T>;
}

/** For endpoints without a body (204). */
export async function unwrapEmpty(call: Promise<{ error?: unknown; response: Response }>): Promise<void> {
  const { error, response } = await call;
  if (error !== undefined || !response.ok) throw toApiError(response, error);
}

export { ApiError };
