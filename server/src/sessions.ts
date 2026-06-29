import { db } from "./db.js";
import { getSettings } from "./settings.js";
import { localDate, shiftDate, clockLabel } from "./time.js";

export interface SessionRow {
  id: number;
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

/** The single active (running or paused) session, if any. */
export function getActiveSession(): SessionRow | undefined {
  return db
    .prepare(`SELECT * FROM sessions WHERE state IN ('running','paused') ORDER BY id DESC LIMIT 1`)
    .get() as SessionRow | undefined;
}

export function getSession(id: number): SessionRow | undefined {
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
}

/** Start a new session. Closes any stale active session first. */
export function startSession(now: number = Date.now()): SessionRow {
  const stale = getActiveSession();
  if (stale) stopSession(stale.id, now);

  const tz = getSettings().timezone;
  const info = db
    .prepare(
      `INSERT INTO sessions (local_date, start_ts, accumulated_ms, last_resumed_at, state)
       VALUES (?, ?, 0, ?, 'running')`
    )
    .run(localDate(tz, now), now, now);
  return getSession(Number(info.lastInsertRowid))!;
}

export function pauseSession(id: number, now: number = Date.now()): SessionRow | undefined {
  const s = getSession(id);
  if (!s || s.state !== "running" || s.last_resumed_at == null) return s;
  const acc = s.accumulated_ms + (now - s.last_resumed_at);
  db.prepare(
    `UPDATE sessions SET accumulated_ms = ?, last_resumed_at = NULL, state = 'paused' WHERE id = ?`
  ).run(acc, id);
  return getSession(id);
}

export function resumeSession(id: number, now: number = Date.now()): SessionRow | undefined {
  const s = getSession(id);
  if (!s || s.state !== "paused") return s;
  db.prepare(
    `UPDATE sessions SET last_resumed_at = ?, state = 'running' WHERE id = ?`
  ).run(now, id);
  return getSession(id);
}

export function stopSession(id: number, now: number = Date.now()): SessionRow | undefined {
  const s = getSession(id);
  if (!s || s.state === "done") return s;
  const acc =
    s.state === "running" && s.last_resumed_at != null
      ? s.accumulated_ms + (now - s.last_resumed_at)
      : s.accumulated_ms;
  db.prepare(
    `UPDATE sessions SET accumulated_ms = ?, last_resumed_at = NULL, end_ts = ?, state = 'done' WHERE id = ?`
  ).run(acc, now, id);
  return getSession(id);
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

/** All sessions for a given local date, oldest first. */
export function sessionsForDate(date: string): SessionRow[] {
  return db
    .prepare(`SELECT * FROM sessions WHERE local_date = ? ORDER BY start_ts ASC`)
    .all(date) as SessionRow[];
}

export interface DaySummary {
  date: string;
  sessions: SessionView[];
  totalMs: number;
  streak: number;
}

export function daySummary(date?: string, now: number = Date.now()): DaySummary {
  const tz = getSettings().timezone;
  const d = date ?? localDate(tz, now);
  const rows = sessionsForDate(d);
  const totalMs = rows.reduce((sum, s) => sum + elapsedMs(s, now), 0);
  return {
    date: d,
    sessions: rows.map((s) => toView(s, tz, now)),
    totalMs,
    streak: computeStreak(now),
  };
}

/**
 * Consecutive days (ending today, or yesterday if nothing done yet today)
 * that each contain at least one completed session.
 */
export function computeStreak(now: number = Date.now()): number {
  const tz = getSettings().timezone;
  const today = localDate(tz, now);

  const daysWithSessions = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT local_date FROM sessions WHERE state = 'done' AND accumulated_ms > 0`
        )
        .all() as { local_date: string }[]
    ).map((r) => r.local_date)
  );

  if (daysWithSessions.size === 0) return 0;

  // Anchor: today if it has a session, otherwise yesterday (streak still alive).
  let cursor = daysWithSessions.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (daysWithSessions.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}
