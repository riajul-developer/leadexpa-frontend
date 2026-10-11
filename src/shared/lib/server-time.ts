// Server-time offset (serverNow − clientNow) from API Date headers, so a wrong phone clock never lies
// about SLA deadlines. Smoothed: only large, consistent changes move it (Date has 1 s resolution).
let offset = 0;
let samples = 0;

export function setServerOffset(next: number) {
  if (!Number.isFinite(next)) return;
  samples += 1;
  // First sample wins outright; later ones move it gradually (network latency adds noise).
  offset = samples === 1 ? next : offset + (next - offset) * 0.2;
}

export function serverNow(): number {
  return Date.now() + offset;
}

export function getServerOffset(): number {
  return offset;
}

/** Test helper. */
export function resetServerOffset() {
  offset = 0;
  samples = 0;
}
