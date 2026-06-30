import { db } from "./db.js";
import { FOCUS_DAY_MAX_MS } from "./config.js";
import {
  getUser,
  currentFocusDate,
  openFocusDay,
  closeFocusDay,
  type User,
} from "./users.js";
import { shiftDate, clockLabel } from "./time.js";

export interface SessionRow {
  id: number;
  user_id: number;
  local_date: string;
  start_ts: number;
  end_ts: number | null;
  accumulated_ms: number;
  last_resumed_at: number | null;
  state: "running" | "paused" | "done";
}

/** Active time of a session, including the in-progress span if running. */
export function elapsedMs(s: SessionRow, now: number = Date.now()): number {
  if (s.state === "running" && s.last_resumed_at != null) {
    return s.accumulated_ms + (now - s.last_resumed_at);
  }
  return s.accumulated_ms;
}

/** The user's single active (running or paused) session, if any. */
export function getActiveSession(userId: number): SessionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM sessions WHERE user_id = ? AND state IN ('running','paused') ORDER BY id DESC LIMIT 1`
    )
    .get(userId) as SessionRow | undefined;
}

export function getSession(userId: number, id: number): SessionRow | undefined {
  return db
    .prepare(`SELECT * FROM sessions WHERE id = ? AND user_id = ?`)
    .get(id, userId) as SessionRow | undefined;
}

/**
 * If the user's open focus day is older than the safety window, close it so a
 * fresh focus day opens. No report is sent (reports are manual).
 */
export function maybeAutoCloseFocusDay(u: User, now: number = Date.now()): void {
  if (
    u.open_focus_date &&
    u.open_focus_opened_ts != null &&
    now - u.open_focus_opened_ts > FOCUS_DAY_MAX_MS
  ) {
    closeFocusDay(u.id);
  }
}

/** Start a new session. Closes any stale active session first. */
export function startSession(userId: number, now: number = Date.now()): SessionRow {
  const stale = getActiveSession(userId);
  if (stale) stopSession(userId, stale.id, now);

  // Re-read after the possible auto-close so we attribute to the right label.
  let u = getUser(userId)!;
  maybeAutoCloseFocusDay(u, now);
  u = getUser(userId)!;
  const label = u.open_focus_date || openFocusDay(u, now);

  const info = db
    .prepare(
      `INSERT INTO sessions (user_id, local_date, start_ts, accumulated_ms, last_resumed_at, state)
       VALUES (?, ?, ?, 0, ?, 'running')`
    )
    .run(userId, label, now, now);
  return getSession(userId, Number(info.lastInsertRowid))!;
}

export function pauseSession(userId: number, id: number, now: number = Date.now()): SessionRow | undefined {
  const s = getSession(userId, id);
  if (!s || s.state !== "running" || s.last_resumed_at == null) return s;
  const acc = s.accumulated_ms + (now - s.last_resumed_at);
  db.prepare(
    `UPDATE sessions SET accumulated_ms = ?, last_resumed_at = NULL, state = 'paused' WHERE id = ?`
  ).run(acc, id);
  return getSession(userId, id);
}

export function resumeSession(userId: number, id: number, now: number = Date.now()): SessionRow | undefined {
  const s = getSession(userId, id);
  if (!s || s.state !== "paused") return s;
  db.prepare(
    `UPDATE sessions SET last_resumed_at = ?, state = 'running' WHERE id = ?`
  ).run(now, id);
  return getSession(userId, id);
}

export function stopSession(userId: number, id: number, now: number = Date.now()): SessionRow | undefined {
  const s = getSession(userId, id);
  if (!s || s.state === "done") return s;
  const acc =
    s.state === "running" && s.last_resumed_at != null
      ? s.accumulated_ms + (now - s.last_resumed_at)
      : s.accumulated_ms;
  db.prepare(
    `UPDATE sessions SET accumulated_ms = ?, last_resumed_at = NULL, end_ts = ?, state = 'done' WHERE id = ?`
  ).run(acc, now, id);
  return getSession(userId, id);
}

export interface SessionView {
  id: number;
  start: string; // HH:mm local
  end: string | null; // HH:mm local or null while active
  durationMs: number;
  state: SessionRow["state"];
}

function toView(s: SessionRow, tz: string, now: number): SessionView {
  return {
    id: s.id,
    start: clockLabel(s.start_ts, tz),
    end: s.end_ts != null ? clockLabel(s.end_ts, tz) : null,
    durationMs: elapsedMs(s, now),
    state: s.state,
  };
}

/** All of a user's sessions for a given focus-day label, oldest first. */
export function sessionsForDate(userId: number, date: string): SessionRow[] {
  return db
    .prepare(`SELECT * FROM sessions WHERE user_id = ? AND local_date = ? ORDER BY start_ts ASC`)
    .all(userId, date) as SessionRow[];
}

export interface DaySummary {
  date: string;
  sessions: SessionView[];
  totalMs: number;
  streak: number;
}

export function daySummary(u: User, date?: string, now: number = Date.now()): DaySummary {
  const d = date ?? currentFocusDate(u, now);
  const rows = sessionsForDate(u.id, d);
  const totalMs = rows.reduce((sum, s) => sum + elapsedMs(s, now), 0);
  return {
    date: d,
    sessions: rows.map((s) => toView(s, u.timezone, now)),
    totalMs,
    streak: computeStreak(u, now),
  };
}

/** Distinct focus-day labels (for this user) that contain completed work. */
function focusDaysWithWork(userId: number): Set<string> {
  return new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT local_date FROM sessions
            WHERE user_id = ? AND state = 'done' AND accumulated_ms > 0`
        )
        .all(userId) as { local_date: string }[]
    ).map((r) => r.local_date)
  );
}

/**
 * Consecutive focus days (ending at the current focus day, or the day before if
 * nothing is done yet) that each contain at least one completed session.
 */
export function computeStreak(u: User, now: number = Date.now()): number {
  const today = currentFocusDate(u, now);
  const days = focusDaysWithWork(u.id);
  if (days.size === 0) return 0;

  let cursor = days.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
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

/** Per focus-day totals plus streak stats over the user's recorded history. */
export function history(u: User, now: number = Date.now()): History {
  const rows = db
    .prepare(
      `SELECT local_date AS date,
              SUM(accumulated_ms) AS totalMs,
              COUNT(*) AS sessionCount
         FROM sessions
        WHERE user_id = ? AND state = 'done' AND accumulated_ms > 0
        GROUP BY local_date
        ORDER BY local_date ASC`
    )
    .all(u.id) as { date: string; totalMs: number; sessionCount: number }[];

  const days = focusDaysWithWork(u.id);
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev != null && shiftDate(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return {
    days: rows.map((r) => ({ date: r.date, totalMs: r.totalMs, sessionCount: r.sessionCount })),
    currentStreak: computeStreak(u, now),
    longestStreak: longest,
    totalMs: rows.reduce((sum, r) => sum + r.totalMs, 0),
  };
}
