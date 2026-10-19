import type { Breadcrumb, ErrorEvent, init } from "@sentry/nextjs";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /\+?[\d০-৯][\d০-৯\s().-]{5,}[\d০-৯]/g;
const PATH_TOKEN = /\/(r|invite|reset-password|verify-email|a)\/[^/?#\s]+/g;
const PII_KEYS = /name|phone|email|body|note|text|message|address|password|token|cookie|authorization/i;
const FILTERED = "[Filtered]";

/** Sentry collects cookies, headers, bodies and locals by default: switch it all off. */
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
} satisfies NonNullable<Parameters<typeof init>[0]>["dataCollection"];

export function scrubText(value: string): string {
  return value.replace(EMAIL, FILTERED).replace(PATH_TOKEN, `/$1/${FILTERED}`).replace(PHONE, FILTERED);
}

/** Drops the query string (often phones or names) and masks path tokens. */
export function scrubUrl(url: string): string {
  return scrubText(url.replace(/[?#].*$/, ""));
}

function scrubRecord(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (PII_KEYS.test(k)) continue;
    if (k === "url" || k === "to" || k === "from") out[k] = typeof v === "string" ? scrubUrl(v) : v;
    else out[k] = typeof v === "string" ? scrubText(v) : v;
  }
  return out;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // Console output can contain whole API payloads; it is not worth the risk.
  if (crumb.category === "console") return null;
  return {
    ...crumb,
    message: crumb.message && scrubText(crumb.message),
    data: scrubRecord(crumb.data),
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  // Only the opaque user id survives (no email, username or IP).
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    event.request = {
      url: event.request.url && scrubUrl(event.request.url),
      method: event.request.method,
    };
  }
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrubText(ex.value);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  }
  event.extra = scrubRecord(event.extra);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  return event;
}
