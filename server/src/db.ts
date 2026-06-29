import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** Create tables and seed the single settings row. Idempotent. */
export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id                   INTEGER PRIMARY KEY CHECK (id = 1),
      name                 TEXT    NOT NULL DEFAULT '',
      timezone             TEXT    NOT NULL DEFAULT 'UTC',
      telegram_bot_token   TEXT    NOT NULL DEFAULT '',
      telegram_channel_id  TEXT    NOT NULL DEFAULT '',
      onboarded            INTEGER NOT NULL DEFAULT 0,
      last_greeting_date   TEXT    NOT NULL DEFAULT '',
      last_report_date     TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      local_date      TEXT    NOT NULL,
      start_ts        INTEGER NOT NULL,
      end_ts          INTEGER,
      accumulated_ms  INTEGER NOT NULL DEFAULT 0,
      last_resumed_at INTEGER,
      state           TEXT    NOT NULL DEFAULT 'running'
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_local_date ON sessions(local_date);
    CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
  `);

  db.prepare(
    `INSERT OR IGNORE INTO settings (id, timezone) VALUES (1, 'UTC')`
  ).run();
}
