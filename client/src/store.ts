import { create } from "zustand";
import {
  api,
  tokens,
  setLogoutHandler,
  refreshAccessToken,
  type ActiveSession,
  type DaySummary,
  type History,
  type PublicSettings,
} from "./api";
import { readCache, writeCache, clearCache, cacheFromBootstrap, type CacheShape } from "./cache";

export type Phase =
  | "splash"
  | "auth"
  | "greeting"
  | "timer"
  | "sessionEnd"
  | "settings"
  | "account"
  | "history";

interface GreetingPayload {
  text: string;
  name: string;
  date: string;
}

interface AppState {
  booted: boolean;
  phase: Phase;
  /** Destination chosen during boot, applied by App after the splash dwell. */
  bootTarget: Phase;
  authed: boolean;
  settings: PublicSettings | null;
  today: DaySummary | null;
  active: ActiveSession | null;
  /** client timestamp (ms) when `active.elapsedMs` was measured, for live ticking */
  anchorAt: number;
  greeting: GreetingPayload | null;
  lastSessionMs: number | null;
  history: History | null;
  cache: CacheShape | null;

  boot: () => Promise<void>;
  connectEvents: () => void;
  disconnectEvents: () => void;
  setPhase: (p: Phase) => void;
  login: (name: string, password: string) => Promise<void>;
  register: (name: string, password: string, timezone: string) => Promise<void>;
  logout: () => Promise<void>;
  dismissGreeting: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  endDay: () => Promise<{ reportSent: boolean; reportError?: string }>;
  refreshToday: () => Promise<void>;
  loadHistory: () => Promise<void>;
  saveSettings: (patch: {
    timezone?: string;
    telegramBotToken?: string;
    telegramChannelId?: string;
  }) => Promise<void>;
}

/** Live elapsed ms for the active session given the current store snapshot. */
export function liveElapsed(s: Pick<AppState, "active" | "anchorAt">, now: number): number {
  if (!s.active) return 0;
  if (s.active.state === "running") return s.active.elapsedMs + (now - s.anchorAt);
  return s.active.elapsedMs;
}

function setActive(set: (p: Partial<AppState>) => void, active: ActiveSession | null) {
  set({ active, anchorAt: Date.now() });
}

// ---- real-time sync (SSE) --------------------------------------------------

type SetFn = (p: Partial<AppState>) => void;
type GetFn = () => AppState;
interface SyncPayload {
  active: ActiveSession | null;
  today: DaySummary;
}

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnecting = false;

function closeEventStream() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnecting = false;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function openEventStream(set: SetFn, get: GetFn) {
  closeEventStream();
  const access = tokens.access();
  if (!access) return;

  const es = new EventSource(`/api/events?token=${encodeURIComponent(access)}`);
  eventSource = es;

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as SyncPayload;
      setActive(set, data.active);
      set({ today: data.today });
      persistToday(get, data.today);
    } catch {
      /* ignore malformed frame */
    }
  };

  es.onerror = () => {
    if (eventSource !== es) return;
    // A rejected/expired token closes the stream permanently — refresh and
    // reconnect. Transient drops leave readyState CONNECTING; the browser
    // auto-retries those, so we don't interfere.
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      eventSource = null;
      scheduleReconnect(set, get);
    }
  };
}

function scheduleReconnect(set: SetFn, get: GetFn) {
  if (reconnecting) return;
  reconnecting = true;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnecting = false;
    if (!tokens.has()) return;
    const ok = await refreshAccessToken().catch(() => false);
    if (ok) openEventStream(set, get);
  }, 1500);
}

export const useStore = create<AppState>((set, get) => ({
  booted: false,
  phase: "splash",
  bootTarget: "auth",
  authed: false,
  settings: null,
  today: null,
  active: null,
  anchorAt: Date.now(),
  greeting: null,
  lastSessionMs: null,
  history: null,
  cache: readCache(),

  boot: async () => {
    // No token → straight to auth. (Splash still dwells in App.)
    if (!tokens.has()) {
      set({ booted: true, authed: false, bootTarget: "auth" });
      return;
    }
    try {
      const b = await api.bootstrap();
      const cache = cacheFromBootstrap(b);
      writeCache(cache);
      set({
        booted: true,
        authed: true,
        settings: b.settings,
        today: b.today,
        active: b.active,
        anchorAt: Date.now(),
        greeting: { text: b.greeting.text, name: b.greeting.name, date: b.greeting.date },
        cache,
      });

      let target: Phase = "timer";
      if (b.active) target = "timer";
      else if (b.greeting.due) target = "greeting";
      set({ bootTarget: target });

      get().connectEvents();
    } catch {
      // Token invalid/expired and refresh failed → auth screen.
      tokens.clear();
      set({ booted: true, authed: false, bootTarget: "auth" });
    }
  },

  connectEvents: () => openEventStream(set, get),
  disconnectEvents: () => closeEventStream(),

  setPhase: (phase) => set({ phase }),

  login: async (name, password) => {
    const r = await api.login(name, password);
    tokens.set(r.accessToken, r.refreshToken);
    await get().boot();
    set({ phase: get().bootTarget === "auth" ? "timer" : get().bootTarget });
  },

  register: async (name, password, timezone) => {
    const r = await api.register(name, password, timezone);
    tokens.set(r.accessToken, r.refreshToken);
    await get().boot();
    set({ phase: "greeting" });
  },

  logout: async () => {
    closeEventStream();
    await api.logout();
    tokens.clear();
    clearCache();
    set({
      authed: false,
      settings: null,
      today: null,
      active: null,
      greeting: null,
      history: null,
      cache: null,
      phase: "auth",
    });
  },

  dismissGreeting: async () => {
    set({ phase: "timer" });
    try {
      await api.greetingSeen();
    } catch {
      /* non-critical */
    }
  },

  start: async () => {
    const { active } = await api.start();
    setActive(set, active);
    set({ phase: "timer" });
  },

  pause: async () => {
    const id = get().active?.id;
    if (!id) return;
    const { active } = await api.pause(id);
    setActive(set, active);
  },

  resume: async () => {
    const id = get().active?.id;
    if (!id) return;
    const { active } = await api.resume(id);
    setActive(set, active);
  },

  stop: async () => {
    const id = get().active?.id;
    if (!id) return;
    const { session, today } = await api.stop(id);
    set({ active: null, today, lastSessionMs: session.durationMs, phase: "sessionEnd" });
    persistToday(get, today);
  },

  endDay: async () => {
    const id = get().active?.id;
    if (id) {
      // capture the in-progress duration for the SessionEnd screen
      const live = liveElapsed(get(), Date.now());
      set({ lastSessionMs: live });
    }
    const { today, reportSent, reportError } = await api.endDay();
    set({ active: null, today, phase: "sessionEnd" });
    persistToday(get, today);
    return { reportSent, reportError };
  },

  refreshToday: async () => {
    const { today } = await api.today();
    set({ today });
  },

  loadHistory: async () => {
    const { history } = await api.history();
    set({ history });
  },

  saveSettings: async (patch) => {
    const { settings } = await api.updateSettings(patch);
    set({ settings });
  },
}));

function persistToday(get: () => AppState, today: DaySummary) {
  const cache = get().cache;
  writeCache({
    name: cache?.name ?? get().settings?.name ?? "",
    onboarded: true,
    todayDate: today.date,
    totalMs: today.totalMs,
    streak: today.streak,
  });
}

// When a refresh ultimately fails, drop straight back to the auth screen.
setLogoutHandler(() => {
  closeEventStream();
  clearCache();
  useStore.setState({
    authed: false,
    settings: null,
    today: null,
    active: null,
    greeting: null,
    history: null,
    cache: null,
    phase: "auth",
  });
});
