import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "chat_back.access_token";
const REFRESH_TOKEN_KEY = "chat_back.refresh_token";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_API_WS_URL?: string;
    EXPO_PUBLIC_MEDIA_BASE_URL?: string;
  };
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
export const API_WS_URL = process.env.EXPO_PUBLIC_API_WS_URL ?? "ws://localhost:3000/realtime";
export const MEDIA_BASE_URL = process.env.EXPO_PUBLIC_MEDIA_BASE_URL ?? "http://localhost:3000";

type RefreshOutcome = "refreshed" | "rejected" | "unavailable";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<RefreshOutcome> | null = null;
const logoutListeners = new Set<(reason: string | null) => void>();

export async function loadStoredTokens() {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  accessToken = access;
  refreshToken = refresh;
  return { accessToken, refreshToken };
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export async function setTokens(tokens: { access_token: string; refresh_token: string }) {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export function onApiLogout(listener: (reason: string | null) => void) {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
}

async function emitLogout(reason: string | null = null) {
  await clearTokens();
  logoutListeners.forEach((listener) => listener(reason));
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/// Only a refusal from the server means the session is really over. Treating a network
/// failure or a rate limit as a rejection would sign the user out for a transient problem.
async function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!refreshToken) return "rejected";
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<RefreshOutcome> => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => null);
    if (!response) return "unavailable";
    if (!response.ok) {
      return response.status === 400 || response.status === 401 || response.status === 403
        ? "rejected"
        : "unavailable";
    }
    const data = await parseResponse(response) as {
      access_token?: string;
      refresh_token?: string;
    } | null;
    if (!data?.access_token || !data.refresh_token) return "unavailable";
    await setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return "refreshed";
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const needsAuth = options.auth !== false;
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (needsAuth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body !== undefined && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? options.body as BodyInit
          : JSON.stringify(options.body),
  }).catch((error: unknown) => {
    throw new ApiError(
      0,
      "Não foi possível conectar ao servidor. Verifique a URL da API e sua conexão.",
      error,
    );
  });

  // Read before refreshing: the body explains why the session was refused, and it can only
  // be consumed once.
  const data = await parseResponse(response);

  if (response.status === 401 && needsAuth && options.retry !== false) {
    const outcome = await refreshAccessToken();
    if (outcome === "refreshed") {
      return apiFetch<T>(path, { ...options, retry: false });
    }
    if (outcome === "rejected") {
      await emitLogout(errorMessage(data, response.status));
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(data, response.status), data);
  }
  return data as T;
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error: unknown }).error);
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  return `HTTP ${status}`;
}

export function mediaAuthHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function isRemoteUrl(uri: string | null | undefined): boolean {
  return typeof uri === "string" && /^https?:\/\//i.test(uri);
}

export async function refreshApiSession(): Promise<boolean> {
  return (await refreshAccessToken()) === "refreshed";
}

export async function healthCheck() {
  return apiFetch<{ ok: boolean }>("/health", { auth: false });
}
