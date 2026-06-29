import { REPORT_TIME } from "../config.js";
import { getSettings, markReportSent } from "../settings.js";
import { sessionsForDate } from "../sessions.js";
import { localDate, localTime } from "../time.js";
import { sendReport } from "./telegram.js";

const TICK_MS = 30_000;

async function tick() {
  const s = getSettings();
  if (!s.telegram_bot_token || !s.telegram_channel_id) return;

  const now = Date.now();
  const today = localDate(s.timezone, now);

  if (localTime(s.timezone, now) !== REPORT_TIME) return; // not report o'clock
  if (s.last_report_date === today) return; // already sent today (dedupe)
  if (sessionsForDate(today).length === 0) return; // nothing to report

  try {
    await sendReport(today);
    markReportSent(today);
    console.log(`[scheduler] daily report sent for ${today}`);
  } catch (err) {
    console.error("[scheduler] failed to send report:", (err as Error).message);
  }
}

/** Start the minute-resolution scheduler that fires the daily report. */
export function startScheduler() {
  void tick();
  setInterval(() => void tick(), TICK_MS);
  console.log(`[scheduler] running — daily report at ${REPORT_TIME} local time`);
}
