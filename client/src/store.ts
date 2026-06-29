import { create } from "zustand";
import { api, type ActiveSession, type DaySummary, type PublicSettings } from "./api";
import { readCache, writeCache, cacheFromBootstrap, type CacheShape } from "./cache";

export type Phase =
  | "splash"
  | "onboarding"
  | "greeting"
  | "timer"
  | "sessionEnd"
  | "settings";

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
  settings: PublicSettings | null;
  today: DaySummary | null;
  active: ActiveSession | null;
  /** client timestamp (ms) when `active.elapsedMs` was measured, for live ticking */
  anchorAt: number;
  greeting: GreetingPayload | null;
  lastSessionMs: number | null;
  cache: CacheShape | null;

  boot: () => Promise<void>;
  setPhase: (p: Phase) => void;
  onboard: (name: string, timezone: string) => Promise<void>;
  dismissGreeting: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  refreshToday: () => Promise<void>;
  saveSettings: (patch: {
    name?: string;
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

export const useStore = create<AppState>((set, get) => ({
  booted: false,
  phase: "splash",
  bootTarget: "timer",
  settings: null,
  today: null,
  active: null,
  anchorAt: Date.now(),
  greeting: null,
  lastSessionMs: null,
  cache: readCache(),

  boot: async () => {
    try {
      const b = await api.bootstrap();
      const cache = cacheFromBootstrap(b);
      writeCache(cache);
      set({
        booted: true,
        settings: b.settings,
        today: b.today,
        active: b.active,
        anchorAt: Date.now(),
        greeting: { text: b.greeting.text, name: b.greeting.name, date: b.greeting.date },
        cache,
      });

      // Decide the first real screen; App applies it after the splash dwell.
      let target: Phase = "timer";
      if (!b.settings.onboarded) target = "onboarding";
      else if (b.active) target = "timer";
      else if (b.greeting.due) target = "greeting";
      set({ bootTarget: target });
    } catch {
      // Backend unreachable — fall through to the timer.
      set({ booted: true, bootTarget: "timer" });
    }
  },

  setPhase: (phase) => set({ phase }),

  onboard: async (name, timezone) => {
    const { settings } = await api.onboard(name, timezone);
    set({ settings, phase: "greeting" });
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
    const cache = get().cache;
    writeCache({
      name: cache?.name ?? "",
      onboarded: true,
      todayDate: today.date,
      totalMs: today.totalMs,
      streak: today.streak,
    });
  },

  refreshToday: async () => {
    const { today } = await api.today();
    set({ today });
  },

  saveSettings: async (patch) => {
    const { settings } = await api.updateSettings(patch);
    set({ settings });
  },
}));
