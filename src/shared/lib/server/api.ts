import "server-only";

import type { components } from "../api/schema";

// Server-side API base (often an internal hostname); falls back to the public URL.
const BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type PublicReport = components["schemas"]["PublicReport"];
export type Report = components["schemas"]["Report"];

/** GET a JSON resource without cookies. Returns null on 404/401 so pages can render a friendly state. */
export async function serverGet<T>(path: string, headers: Record<string, string> = {}): Promise<T | null> {
  const res = await fetch(BASE + path, { headers: { Accept: "application/json", ...headers }, cache: "no-store" });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
