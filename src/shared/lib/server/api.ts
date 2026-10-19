import "server-only";

import type { components } from "../api/schema";

const BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type PublicReport = components["schemas"]["PublicReport"];
export type Report = components["schemas"]["Report"];

export async function serverGet<T>(path: string, headers: Record<string, string> = {}): Promise<T | null> {
  const res = await fetch(BASE + path, { headers: { Accept: "application/json", ...headers }, cache: "no-store" });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
