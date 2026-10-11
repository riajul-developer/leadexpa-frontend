// Product analytics (FRONTEND_PROMPT §15): consent-aware, PII-free. Events are named feature.object.action.
// PostHog loads lazily and only when a key is configured and the user consented; otherwise calls are no-ops.
type Props = Record<string, string | number | boolean | null | undefined>;

interface Client {
  capture: (event: string, props?: Props) => void;
  identify: (id: string, props?: Props) => void;
  group: (type: string, key: string) => void;
  reset: () => void;
}

let client: Client | null = null;
let loading: Promise<void> | null = null;
const queue: [string, Props | undefined][] = [];

const PII_KEYS = /name|phone|email|body|note|text|message/i;

/** Drops anything that looks like PII before it leaves the browser. */
export function scrub(props?: Props): Props | undefined {
  if (!props) return props;
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) if (!PII_KEYS.test(k)) out[k] = v;
  return out;
}

export function initAnalytics(consented: boolean) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!consented || !key || client || loading || typeof window === "undefined") return;
  loading = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      autocapture: false,
      capture_pageview: true,
      disable_session_recording: true, // never record lead screens
      persistence: "localStorage",
      mask_all_text: true,
    });
    client = posthog as unknown as Client;
    for (const [e, p] of queue.splice(0)) client.capture(e, p);
  });
}

export function track(event: string, props?: Props) {
  const clean = scrub(props);
  if (client) client.capture(event, clean);
  else if (queue.length < 50) queue.push([event, clean]);
}

/** Agency-level grouping for validation metrics (weekly active agents per agency). Ids only. */
export function identify(userId: string, agencyId: string | null, role: string | null) {
  client?.identify(userId, { role: role ?? undefined });
  if (agencyId) client?.group("agency", agencyId);
}

export function resetAnalytics() {
  client?.reset();
}
