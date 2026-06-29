import { db } from "./db.js";

export interface Settings {
  id: number;
  name: string;
  timezone: string;
  telegram_bot_token: string;
  telegram_channel_id: string;
  onboarded: number;
  last_greeting_date: string;
  last_report_date: string;
}

export function getSettings(): Settings {
  return db.prepare(`SELECT * FROM settings WHERE id = 1`).get() as Settings;
}

/** Public view of settings (Telegram token masked) for the client. */
export function publicSettings() {
  const s = getSettings();
  return {
    name: s.name,
    timezone: s.timezone,
    telegramChannelId: s.telegram_channel_id,
    telegramConfigured: s.telegram_bot_token.length > 0 && s.telegram_channel_id.length > 0,
    onboarded: s.onboarded === 1,
  };
}

type SettingsPatch = Partial<{
  name: string;
  timezone: string;
  telegramBotToken: string;
  telegramChannelId: string;
}>;

export function updateSettings(patch: SettingsPatch): void {
  const cur = getSettings();
  db.prepare(
    `UPDATE settings SET name = ?, timezone = ?, telegram_bot_token = ?, telegram_channel_id = ? WHERE id = 1`
  ).run(
    patch.name ?? cur.name,
    patch.timezone ?? cur.timezone,
    patch.telegramBotToken ?? cur.telegram_bot_token,
    patch.telegramChannelId ?? cur.telegram_channel_id
  );
}

export function completeOnboarding(name: string, timezone: string): void {
  db.prepare(
    `UPDATE settings SET name = ?, timezone = ?, onboarded = 1 WHERE id = 1`
  ).run(name, timezone);
}

export function markGreetingSeen(date: string): void {
  db.prepare(`UPDATE settings SET last_greeting_date = ? WHERE id = 1`).run(date);
}

export function markReportSent(date: string): void {
  db.prepare(`UPDATE settings SET last_report_date = ? WHERE id = 1`).run(date);
}
