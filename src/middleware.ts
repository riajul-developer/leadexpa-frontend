import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { isCustomHost } from "./shared/lib/hosts";

const intl = createIntlMiddleware(routing);

const PUBLIC_SEGMENTS = new Set([
  "login",
  "signup",
  "verify-email",
  "forgot-password",
  "reset-password",
  "invite",
  "r",
  "t",
  "pay", // the payer has no account
  "buy", // reseller checkout: the customer has no account
  "book", // self-booking: the lead has no account
  "appt", // the lead's appointment link
  "audit", // a Leakage Audit shared with a prospect
  "qbr", // a business review shared with a client
  "p", // the client portal's branded sign-in
  "status", // the public status page
  "features",
]);

// CSRF cookie lives as long as the refresh token: a cheap hint; real auth is /v1/me.
const SESSION_COOKIE = "recov_csrf";

function csp(nonce: string, isDev: boolean, frameAncestors: string): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";
  const status = process.env.NEXT_PUBLIC_STATUS_API_URL ?? ""; // control plane's public status API
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${api} ${status} ${posthog} https://*.ingest.sentry.io`.replace(/  +/g, " ").trim(),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}

// Forwards extra request headers alongside next-intl's, like NextResponse.next().
function forwardRequestHeaders(res: NextResponse, req: NextRequest, extra: Record<string, string>) {
  const listed = res.headers.get("x-middleware-override-headers");
  const names = new Set(listed ? listed.split(",") : [...req.headers.keys()]);
  if (!listed) for (const [k, v] of req.headers) res.headers.set(`x-middleware-request-${k}`, v);
  for (const [k, v] of Object.entries(extra)) {
    names.add(k);
    res.headers.set(`x-middleware-request-${k}`, v);
  }
  res.headers.set("x-middleware-override-headers", [...names].join(","));
}

// On a custom domain the root redirects to that agency's branded portal sign-in.
async function customHostRoot(req: NextRequest): Promise<NextResponse | null> {
  const host = req.headers.get("host");
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const locale = routing.locales.find((l) => l === segments[0]);
  if (!isCustomHost(host) || segments.length > (locale ? 1 : 0)) return null;
  const api = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  try {
    const res = await fetch(`${api}/v1/public/brand-by-domain?host=${encodeURIComponent(host ?? "")}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const brand = (await res.json()) as { slug: string };
    const url = req.nextUrl.clone();
    const preferred = req.cookies.get("NEXT_LOCALE")?.value;
    const lang = locale ?? routing.locales.find((l) => l === preferred) ?? routing.defaultLocale;
    url.pathname = `/${lang}/p/${brand.slug}`;
    url.search = "";
    return NextResponse.redirect(url);
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const portal = await customHostRoot(req);
  if (portal) return portal;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const { pathname } = req.nextUrl;
  const isPrint = pathname.startsWith("/print/");
  // The PDF renderer loads print routes directly; only same-origin may frame them.
  const policy = csp(nonce, isDev, isPrint ? "'self'" : "'none'");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  let res: NextResponse;
  if (isPrint) {
    res = NextResponse.next({ request: { headers } });
  } else {
    const segments = pathname.split("/").filter(Boolean);
    const [maybeLocale, first] = segments;
    const hasLocale = routing.locales.includes(maybeLocale as (typeof routing.locales)[number]);
    const section = hasLocale ? first : maybeLocale;
    const mocking = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
    // The lite app has its own phone sign-in; its login page is public.
    const lite = section === "lite";
    const liteLogin = lite && segments[2] === "login";
    if (
      hasLocale &&
      section &&
      !PUBLIC_SEGMENTS.has(section) &&
      !liteLogin &&
      !mocking &&
      !req.cookies.has(SESSION_COOKIE)
    ) {
      const url = req.nextUrl.clone();
      url.pathname = lite ? `/${maybeLocale}/lite/login` : `/${maybeLocale}/login`;
      url.search = `?returnTo=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      res = NextResponse.redirect(url);
    } else {
      res = intl(req);
      forwardRequestHeaders(res, req, { "x-nonce": nonce, "content-security-policy": policy });
    }
  }
  res.headers.set("Content-Security-Policy", policy);
  if (pathname.includes("/r/")) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Everything except API routes, Next internals, static files and the MSW worker.
  matcher: ["/((?!api|_next|_vercel|mockServiceWorker\.js|sw\.js|manifest\.webmanifest|icons|.*\..*).*)"],
};
