// Offset from API Date headers, so a wrong phone clock can't skew SLA deadlines.
let offset = 0;
let samples = 0;

export function setServerOffset(next: number) {
  if (!Number.isFinite(next)) return;
  samples += 1;
  offset = samples === 1 ? next : offset + (next - offset) * 0.2;
}

export function serverNow(): number {
  return Date.now() + offset;
}

export function getServerOffset(): number {
  return offset;
}

export function resetServerOffset() {
  offset = 0;
  samples = 0;
}
