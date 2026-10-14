import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_WS_URL, apiFetch, getAccessToken } from "./client";

const LAST_EVENT_AT_KEY = "chat_back.last_event_at";

export type RealtimeEvent = {
  id: string;
  type: string;
  tenant_id: string;
  chat_id: string | null;
  entity_id: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
};

type Listener = (event: RealtimeEvent) => void;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = true;
  private lastEventAt: string | null = null;
  private cursorLoaded = false;
  private catchUpInFlight: Promise<void> | null = null;

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // The event log is append-only, so asking for it without a cursor replayed the oldest
  // events of the whole tenant on every cold start. A fresh install starts from now: it has
  // no local state that those events could reconcile.
  private async loadCursor(): Promise<string> {
    if (this.cursorLoaded && this.lastEventAt) return this.lastEventAt;
    const stored = await AsyncStorage.getItem(LAST_EVENT_AT_KEY).catch(() => null);
    this.cursorLoaded = true;
    if (!this.lastEventAt || (stored && stored > this.lastEventAt)) {
      this.lastEventAt = stored ?? new Date().toISOString();
    }
    if (!stored) {
      await AsyncStorage.setItem(LAST_EVENT_AT_KEY, this.lastEventAt).catch(() => {});
    }
    return this.lastEventAt;
  }

  catchUp(): Promise<void> {
    if (this.catchUpInFlight) return this.catchUpInFlight;
    this.catchUpInFlight = (async () => {
      const after = await this.loadCursor();
      const qs = new URLSearchParams({ after });
      const events = await apiFetch<RealtimeEvent[]>(`/realtime/events?${qs}`).catch(() => []);
      for (const event of events) this.dispatch(event);
    })().finally(() => {
      this.catchUpInFlight = null;
    });
    return this.catchUpInFlight;
  }

  async resetCursor(): Promise<void> {
    this.lastEventAt = null;
    this.cursorLoaded = false;
    await AsyncStorage.removeItem(LAST_EVENT_AT_KEY).catch(() => {});
  }

  private connect() {
    const token = getAccessToken();
    if (this.stopped || !token) return;
    const separator = API_WS_URL.includes("?") ? "&" : "?";
    const ws = new WebSocket(`${API_WS_URL}${separator}access_token=${encodeURIComponent(token)}`);
    this.socket = ws;

    ws.onopen = () => {
      this.attempts = 0;
      void this.catchUp();
    };
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(String(message.data));
        if (data?.type === "hello") return;
        // The server drops events for a socket that falls behind and asks it to reconcile
        // over HTTP, because those events cannot be replayed on the channel.
        if (data?.type === "resync") {
          void this.catchUp();
          return;
        }
        this.dispatch(data as RealtimeEvent);
      } catch {}
    };
    ws.onclose = () => this.scheduleReconnect();
    ws.onerror = () => this.scheduleReconnect();
  }

  private dispatch(event: RealtimeEvent) {
    if (!event?.occurred_at) return;
    if (!this.lastEventAt || event.occurred_at > this.lastEventAt) {
      this.lastEventAt = event.occurred_at;
      void AsyncStorage.setItem(LAST_EVENT_AT_KEY, event.occurred_at).catch(() => {});
    }
    this.listeners.forEach((listener) => listener(event));
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * 2 ** this.attempts);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const realtimeClient = new RealtimeClient();
