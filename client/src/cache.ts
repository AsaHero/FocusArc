import type { Bootstrap } from "./api";

const KEY = "focusarc.cache.v1";

export interface CacheShape {
  name: string;
  todayDate: string;
  totalMs: number;
  streak: number;
  onboarded: boolean;
}

/** Instant-read mirror of the last known state (SQLite remains source of truth). */
export function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

export function writeCache(c: CacheShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function cacheFromBootstrap(b: Bootstrap): CacheShape {
  return {
    name: b.settings.name,
    todayDate: b.today.date,
    totalMs: b.today.totalMs,
    streak: b.today.streak,
    onboarded: b.settings.onboarded,
  };
}
