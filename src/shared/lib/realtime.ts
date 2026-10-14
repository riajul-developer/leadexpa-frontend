// One SSE connection per browser (FRONTEND_PROMPT §4.3). Tabs elect a leader with the Web Locks API; the
// leader owns the EventSource and rebroadcasts every event over a BroadcastChannel, so ten open tabs are
// still one connection. Reconnects with backoff and resumes with last_event_id; pauses after 5 minutes
// hidden and asks listeners to resync when the tab comes back.
import { apiBase } from "./api/client";

export const STREAM_EVENTS = [
  "lead.created",
  "lead.updated",
  "lead.assigned",
  "activity.created",
  "sla.warning",
  "sla.breached",
  "sla.escalated",
  "notification.created",
  "import.progress",
  "integration.health_changed",
  "connector.health_changed",
  "conversion.destination_health_changed",
  "message.created",
  "message.updated",
  "conversation.claimed",
  "payment.paid",
  "reseller.sale",
  "agent.handoff",
  "agent.draft",
  "presence.changed",
] as const;
export type StreamEventType = (typeof STREAM_EVENTS)[number];

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  data: Record<string, unknown>;
}

type Listener = (e: StreamEvent) => void;
type StatusListener = (s: StreamStatus) => void;
export type StreamStatus = "connecting" | "open" | "paused" | "offline";

const HIDDEN_PAUSE_MS = 5 * 60_000;
const CHANNEL = "recov-stream";
const LOCK = "recov-stream-leader";

export class Realtime {
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private resyncListeners = new Set<() => void>();
  private source: EventSource | null = null;
  private channel: BroadcastChannel | null = null;
  private lastEventId = "";
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private releaseLock: (() => void) | null = null;
  private leader = false;
  private stopped = true;
  private status: StreamStatus = "connecting";

  constructor(private readonly fixedUrl?: string) {}

  private get url() {
    return this.fixedUrl ?? `${apiBase()}/v1/stream`; // the agency's region (G1)
  }

  start() {
    if (!this.stopped || typeof window === "undefined") return;
    this.stopped = false;
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (m: MessageEvent<{ kind: string; event?: StreamEvent; status?: StreamStatus }>) => {
        if (m.data.kind === "event" && m.data.event) this.emit(m.data.event, false);
        if (m.data.kind === "status" && m.data.status && !this.leader) this.setStatus(m.data.status, false);
        if (m.data.kind === "wake" && this.leader && !this.source) {
          this.connect();
          this.resync();
        }
      };
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("online", this.onOnline);
    this.elect();
  }

  stop() {
    this.stopped = true;
    this.close();
    this.releaseLock?.();
    this.releaseLock = null;
    this.leader = false;
    this.channel?.close();
    this.channel = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("online", this.onOnline);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }
  /** Fired after a gap (reconnect, tab back from a long pause): refetch what may have been missed. */
  onResync(fn: () => void): () => void {
    this.resyncListeners.add(fn);
    return () => this.resyncListeners.delete(fn);
  }

  private elect() {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks || !this.channel) {
      this.becomeLeader();
      return;
    }
    // Held until this tab closes or stops; the next tab in line takes over automatically.
    void locks.request(LOCK, () => {
      if (this.stopped) return Promise.resolve();
      this.becomeLeader();
      return new Promise<void>((resolve) => {
        this.releaseLock = resolve;
      });
    });
  }

  private becomeLeader() {
    this.leader = true;
    if (document.visibilityState === "visible" || !this.channel) this.connect();
  }

  private connect() {
    if (this.stopped || this.source) return;
    this.setStatus("connecting");
    const url = this.lastEventId ? `${this.url}?last_event_id=${encodeURIComponent(this.lastEventId)}` : this.url;
    const es = new EventSource(url, { withCredentials: true });
    this.source = es;
    es.onopen = () => {
      const resumed = this.attempt > 0;
      this.attempt = 0;
      this.setStatus("open");
      if (resumed) this.resync();
    };
    es.onerror = () => {
      // EventSource retries by itself on network blips, but gives up on HTTP errors (e.g. 401 after
      // logout). Take over with our own backoff; the API client refreshes the session meanwhile.
      if (es.readyState === EventSource.CLOSED) this.scheduleReconnect();
      else this.setStatus("connecting");
    };
    for (const type of STREAM_EVENTS) {
      es.addEventListener(type, (raw) => {
        const m = raw as MessageEvent<string>;
        if (m.lastEventId) this.lastEventId = m.lastEventId;
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(m.data) as Record<string, unknown>;
        } catch {
          /* keep {} */
        }
        this.emit({ id: m.lastEventId, type, data }, true);
      });
    }
  }

  private scheduleReconnect() {
    this.close();
    if (this.stopped) return;
    this.setStatus(navigator.onLine ? "connecting" : "offline");
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt) * (0.75 + Math.random() * 0.5);
    this.attempt += 1;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private close() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.source?.close();
    this.source = null;
  }

  private emit(e: StreamEvent, fromSource: boolean) {
    this.listeners.forEach((l) => l(e));
    if (fromSource) this.channel?.postMessage({ kind: "event", event: e });
  }

  private setStatus(s: StreamStatus, broadcast = true) {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
    if (broadcast && this.leader) this.channel?.postMessage({ kind: "status", status: s });
  }

  private resync() {
    this.resyncListeners.forEach((l) => l());
  }

  private onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (!this.leader) return;
      this.hiddenTimer = setTimeout(() => {
        this.close();
        this.setStatus("paused");
      }, HIDDEN_PAUSE_MS);
      return;
    }
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    // A visible follower wakes a leader that paused while hidden in the background.
    if (!this.leader) this.channel?.postMessage({ kind: "wake" });
    if (this.leader && !this.source) {
      this.connect();
      this.resync();
    }
  };

  private onOnline = () => {
    if (this.leader && !this.source) {
      this.attempt = 0;
      this.connect();
    }
  };
}

export const realtime = new Realtime();
