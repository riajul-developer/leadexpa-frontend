/** Levenshtein distance over code points (AI feedback "edited" sends how much the agent changed a draft). */
export function editDistance(a: string, b: string, cap = 2000): number {
  const x = [...a].slice(0, cap);
  const y = [...b].slice(0, cap);
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[y.length]!;
}

/** sessionStorage that never throws (private mode, blocked storage). */
export const sessionStore = {
  get<T>(key: string): T | null {
    try {
      const v = sessionStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
