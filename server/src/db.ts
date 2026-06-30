import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** True if `table` already has a column named `column`. */
function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/** Create tables and run lightweight migrations. Idempotent. */
export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT    NOT NULL UNIQUE,
      password_hash        TEXT    NOT NULL,
      timezone             TEXT    NOT NULL DEFAULT 'UTC',
      telegram_bot_token   TEXT    NOT NULL DEFAULT '',
      telegram_channel_id  TEXT    NOT NULL DEFAULT '',
      onboarded            INTEGER NOT NULL DEFAULT 1,
      last_greeting_date   TEXT    NOT NULL DEFAULT '',
      open_focus_date      TEXT    NOT NULL DEFAULT '',
      open_focus_opened_ts INTEGER,
      created_at           INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token       TEXT    PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      local_date      TEXT    NOT NULL,
      start_ts        INTEGER NOT NULL,
      end_ts          INTEGER,
      accumulated_ms  INTEGER NOT NULL DEFAULT 0,
      last_resumed_at INTEGER,
      state           TEXT    NOT NULL DEFAULT 'running'
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `);

  // Migrate a pre-auth `sessions` table that predates the user_id column.
  if (!hasColumn("sessions", "user_id")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, local_date)`);
}
