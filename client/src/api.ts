export interface SessionView {
  id: number;
  start: string;
  end: string | null;
  durationMs: number;
  state: "running" | "paused" | "done";
}

export interface DaySummary {
  date: string;
  sessions: SessionView[];
  totalMs: number;
  streak: number;
}

export interface PublicSettings {
  name: string;
  timezone: string;
  telegramChannelId: string;
  telegramConfigured: boolean;
  onboarded: boolean;
}

export interface ActiveSession {
  id: number;
  state: "running" | "paused";
  elapsedMs: number;
  startTs: number;
}

export interface Bootstrap {
  settings: PublicSettings;
  today: DaySummary;
  active: ActiveSession | null;
  greeting: { due: boolean; text: string; name: string; date: string };
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicSettings;
}

export interface HistoryDay {
  date: string;
  totalMs: number;
  sessionCount: number;
}

export interface History {
  days: HistoryDay[];
  currentStreak: number;
  longestStreak: number;
  totalMs: number;
}

// ---- token storage (localStorage) -----------------------------------------

const ACCESS_KEY = "focusarc.accessToken";
const REFRESH_KEY = "focusarc.refreshToken";

export const tokens = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  has: () => !!localStorage.getItem(ACCESS_KEY),
};

/** Called when refresh fails — lets the store reset to the auth screen. */
let onLogout: (() => void) | null = null;
export function setLogoutHandler(fn: () => void) {
  onLogout = fn;
}

export class AuthError extends Error {}

async function rawReq<T>(path: string, init: RequestInit, withAuth: boolean): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (withAuth) {
    const access = tokens.access();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  const res = await fetch(`/api${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
    if (res.status === 401) Object.setPrototypeOf(err, AuthError.prototype);
    throw err;
  }
  return json as T;
}

/** Try to refresh the access token once. Returns true on success. */
async function tryRefresh(): Promise<boolean> {
  const refresh = tokens.refresh();
  if (!refresh) return false;
  try {
    const r = await rawReq<AuthResult>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken: refresh }) },
      false
    );
    tokens.set(r.accessToken, r.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/** Authenticated request with transparent one-shot refresh-and-retry on 401. */
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawReq<T>(path, init, true);
  } catch (err) {
    if (err instanceof AuthError && (await tryRefresh())) {
      return rawReq<T>(path, init, true);
    }
    if (err instanceof AuthError) {
      tokens.clear();
      onLogout?.();
    }
    throw err;
  }
}

export const api = {
  // auth (public)
  register: (name: string, password: string, timezone: string) =>
    rawReq<AuthResult>(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ name, password, timezone }) },
      false
    ),
  login: (name: string, password: string) =>
    rawReq<AuthResult>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ name, password }) },
      false
    ),
  logout: () => {
    const refresh = tokens.refresh();
    return rawReq<{ ok: true }>(
      "/auth/logout",
      { method: "POST", body: JSON.stringify({ refreshToken: refresh }) },
      false
    ).catch(() => ({ ok: true as const }));
  },

  // app (authenticated)
  bootstrap: () => req<Bootstrap>("/bootstrap"),
  me: () => req<{ user: PublicSettings }>("/auth/me"),

  greetingSeen: () => req<{ ok: true }>("/greeting/seen", { method: "POST" }),

  updateSettings: (patch: {
    timezone?: string;
    telegramBotToken?: string;
    telegramChannelId?: string;
  }) =>
    req<{ settings: PublicSettings }>("/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  start: () => req<{ active: ActiveSession }>("/sessions/start", { method: "POST" }),
  pause: (id: number) =>
    req<{ active: ActiveSession }>("/sessions/pause", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  resume: (id: number) =>
    req<{ active: ActiveSession }>("/sessions/resume", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  stop: (id: number) =>
    req<{ session: { id: number; durationMs: number }; today: DaySummary }>("/sessions/stop", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  today: () => req<{ today: DaySummary }>("/today"),
  history: () => req<{ history: History }>("/history"),

  endDay: () =>
    req<{ today: DaySummary; reportSent: boolean; reportError?: string }>("/day/end", {
      method: "POST",
    }),
  sendReport: () => req<{ ok: true }>("/report/send", { method: "POST" }),

  changePassword: (current: string, next: string) =>
    req<{ ok: true }>("/account/password", {
      method: "PUT",
      body: JSON.stringify({ current, next }),
    }),
  deleteAccount: () => req<{ ok: true }>("/account", { method: "DELETE" }),
};
