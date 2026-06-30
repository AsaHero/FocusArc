import { db } from "./db.js";
import { hashPassword } from "./auth.js";
import { localDate } from "./time.js";

export interface User {
  id: number;
  name: string;
  password_hash: string;
  timezone: string;
  telegram_bot_token: string;
  telegram_channel_id: string;
  onboarded: number;
  last_greeting_date: string;
  open_focus_date: string;
  open_focus_opened_ts: number | null;
  created_at: number;
}

export function getUser(id: number): User | undefined {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User | undefined;
}

export function getUserByName(name: string): User | undefined {
  return db.prepare(`SELECT * FROM users WHERE name = ?`).get(name) as User | undefined;
}

/** Create a user. Throws if the name is taken (UNIQUE constraint). */
export function createUser(name: string, password: string, timezone: string): User {
  const info = db
    .prepare(
      `INSERT INTO users (name, password_hash, timezone, created_at) VALUES (?, ?, ?, ?)`
    )
    .run(name, hashPassword(password), timezone, Date.now());
  return getUser(Number(info.lastInsertRowid))!;
}

/** Public view of a user (secrets and tokens stripped) for the client. */
export function publicUser(u: User) {
  return {
    name: u.name,
    timezone: u.timezone,
    telegramChannelId: u.telegram_channel_id,
    telegramConfigured: u.telegram_bot_token.length > 0 && u.telegram_channel_id.length > 0,
    onboarded: u.onboarded === 1,
  };
}

type UserPatch = Partial<{
  name: string;
  timezone: string;
  telegramBotToken: string;
  telegramChannelId: string;
}>;

export function updateUser(id: number, patch: UserPatch): void {
  const cur = getUser(id);
  if (!cur) return;
  db.prepare(
    `UPDATE users
       SET name = ?, timezone = ?, telegram_bot_token = ?, telegram_channel_id = ?
     WHERE id = ?`
  ).run(
    patch.name ?? cur.name,
    patch.timezone ?? cur.timezone,
    patch.telegramBotToken ?? cur.telegram_bot_token,
    patch.telegramChannelId ?? cur.telegram_channel_id,
    id
  );
}

export function changePassword(id: number, nextPlain: string): void {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(nextPlain), id);
}

export function deleteUser(id: number): void {
  // sessions + refresh_tokens cascade via ON DELETE CASCADE.
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
}

export function markGreetingSeen(id: number, date: string): void {
  db.prepare(`UPDATE users SET last_greeting_date = ? WHERE id = ?`).run(date, id);
}

// ---- focus day -------------------------------------------------------------

/**
 * The label of the day work currently counts toward: the open focus day if one
 * is open, otherwise the user's calendar date right now.
 */
export function currentFocusDate(u: User, now: number = Date.now()): string {
  return u.open_focus_date || localDate(u.timezone, now);
}

/** Open a focus day for the user, labelled by their current calendar date. */
export function openFocusDay(u: User, now: number = Date.now()): string {
  const label = localDate(u.timezone, now);
  db.prepare(
    `UPDATE users SET open_focus_date = ?, open_focus_opened_ts = ? WHERE id = ?`
  ).run(label, now, u.id);
  return label;
}

/** Clear the open focus day (after End day or a safety auto-close). */
export function closeFocusDay(id: number): void {
  db.prepare(
    `UPDATE users SET open_focus_date = '', open_focus_opened_ts = NULL WHERE id = ?`
  ).run(id);
}
