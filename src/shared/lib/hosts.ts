// Any host not in NEXT_PUBLIC_APP_HOSTS is a custom portal domain.
const APP_HOSTS = (process.env.NEXT_PUBLIC_APP_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function isCustomHost(host: string | null | undefined): boolean {
  if (!host || APP_HOSTS.length === 0) return false;
  return !APP_HOSTS.includes(host.toLowerCase());
}
