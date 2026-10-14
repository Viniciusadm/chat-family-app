import AsyncStorage from "@react-native-async-storage/async-storage";
import { base64ToBytes, utf8Decode } from "@/lib/crypto/encoding";
import { API_WS_URL, apiFetch, getAccessToken, refreshApiSession } from "./client";

const LAST_EVENT_AT_KEY = "chat_back.last_event_at";
const TOKEN_EXPIRY_MARGIN_MS = 30_000;
const CATCH_UP_PAGE_SIZE = 500;
const CATCH_UP_OVERLAP_MS = 10_000;
const SEEN_EVENT_IDS_LIMIT = 2_000;

function eventTime(occurredAt: string): number {
  const time = Date.parse(occurredAt);
  return Number.isNaN(time) ? 0 : time;
}

function accessTokenExpiresSoon(token: string): boolean {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const { exp } = JSON.parse(utf8Decode(base64ToBytes(padded))) as { exp?: number };
    return typeof exp === "number" && exp * 1000 - TOKEN_EXPIRY_MARGIN_MS < Date.now();
  } catch {
    return false;
  }
}

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
  private seenEventIds = new Set<string>();

  private connecting = false;

  start() {
    if (!this.stopped && (this.socket || this.reconnectTimer || this.connecting)) return;
    this.stopped = false;
    void this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.closeSocket();
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
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
    const firstLoad = !this.cursorLoaded;
    this.cursorLoaded = true;
    if (stored && (firstLoad || !this.lastEventAt)) {
      return stored;
    }
    this.lastEventAt ??= new Date().toISOString();
    if (!stored) {
      await AsyncStorage.setItem(LAST_EVENT_AT_KEY, this.lastEventAt).catch(() => {});
    }
    return this.lastEventAt;
  }

  catchUp(): Promise<void> {
    if (this.catchUpInFlight) return this.catchUpInFlight;
    this.catchUpInFlight = (async () => {
      const cursor = await this.loadCursor();
      let after = new Date(eventTime(cursor) - CATCH_UP_OVERLAP_MS).toISOString();
      for (;;) {
        const qs = new URLSearchParams({ after, limit: String(CATCH_UP_PAGE_SIZE) });
        const events = await apiFetch<RealtimeEvent[]>(`/realtime/events?${qs}`).catch(
          () => null,
        );
        if (!events) return;
        for (const event of events) this.dispatch(event);
        if (events.length < CATCH_UP_PAGE_SIZE) return;
        after = events[events.length - 1].occurred_at;
      }
    })().finally(() => {
      this.catchUpInFlight = null;
    });
    return this.catchUpInFlight;
  }

  async resetCursor(): Promise<void> {
    this.lastEventAt = null;
    this.cursorLoaded = false;
    this.seenEventIds.clear();
    await AsyncStorage.removeItem(LAST_EVENT_AT_KEY).catch(() => {});
  }

  private async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    try {
      let token = getAccessToken();
      if (token && accessTokenExpiresSoon(token) && (await refreshApiSession())) {
        token = getAccessToken();
      }
      if (this.stopped || !token) return;
      this.openSocket(token);
    } finally {
      this.connecting = false;
    }
  }

  private openSocket(token: string) {
    this.closeSocket();
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
    ws.onclose = () => this.handleSocketLost(ws);
    ws.onerror = () => this.handleSocketLost(ws);
  }

  private handleSocketLost(ws: WebSocket) {
    if (this.socket !== ws) return;
    this.closeSocket();
    this.scheduleReconnect();
  }

  private markSeen(eventId: string): boolean {
    if (this.seenEventIds.has(eventId)) return false;
    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > SEEN_EVENT_IDS_LIMIT) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest !== undefined) this.seenEventIds.delete(oldest);
    }
    return true;
  }

  private dispatch(event: RealtimeEvent) {
    if (!event?.occurred_at) return;
    if (event.id && !this.markSeen(event.id)) return;
    if (!this.lastEventAt || eventTime(event.occurred_at) >= eventTime(this.lastEventAt)) {
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
      void this.connect();
    }, delay);
  }
}

export const realtimeClient = new RealtimeClient();
