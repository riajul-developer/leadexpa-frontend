// Custom portal domains (8f-2): an agency's clients can reach the portal on portal.theiragency.com. Every host
// not listed in NEXT_PUBLIC_APP_HOSTS (our own hosts, comma-separated) is such a custom domain. Unset: none are.
const APP_HOSTS = (process.env.NEXT_PUBLIC_APP_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function isCustomHost(host: string | null | undefined): boolean {
  if (!host || APP_HOSTS.length === 0) return false;
  return !APP_HOSTS.includes(host.toLowerCase());
}
