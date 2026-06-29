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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

export const api = {
  bootstrap: () => req<Bootstrap>("/bootstrap"),

  onboard: (name: string, timezone: string) =>
    req<{ settings: PublicSettings }>("/onboarding", {
      method: "POST",
      body: JSON.stringify({ name, timezone }),
    }),

  greetingSeen: () => req<{ ok: true }>("/greeting/seen", { method: "POST" }),

  updateSettings: (patch: {
    name?: string;
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

  testReport: () => req<{ ok: true }>("/report/test", { method: "POST" }),
};
