import { getUser, currentFocusDate } from "../users.js";
import { daySummary, sessionsForDate, type DaySummary } from "../sessions.js";
import { renderReportImage } from "./render.js";
import { prettyDate } from "../time.js";

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** PART 2 — the text summary message. */
export function buildReportText(summary: DaySummary): string {
  const lines: string[] = [];
  lines.push(`📅 ${prettyDate(summary.date)}`);
  lines.push("");
  lines.push(`⏱ Total: ${fmtDuration(summary.totalMs)}`);
  lines.push(`🔥 Streak: ${summary.streak} day${summary.streak === 1 ? "" : "s"}`);
  lines.push("");
  lines.push("Sessions:");
  for (const s of summary.sessions) {
    const end = s.end ?? "…";
    lines.push(`  ${s.start} – ${end} · ${fmtDuration(s.durationMs)}`);
  }
  return lines.join("\n");
}

async function tg(token: string, method: string, body: FormData | object) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const init: RequestInit =
    body instanceof FormData
      ? { method: "POST", body }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const res = await fetch(url, init);
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.statusText}`);
  }
  return json;
}

/**
 * Render and send a user's daily report (image + text) to their channel.
 * Throws if Telegram is not configured or the API rejects the request.
 */
export async function sendReport(userId: number, date?: string): Promise<void> {
  const u = getUser(userId);
  if (!u) throw new Error("User not found");
  if (!u.telegram_bot_token || !u.telegram_channel_id) {
    throw new Error("Telegram is not configured. Add a bot token and channel ID in Settings.");
  }

  const d = date ?? currentFocusDate(u);
  const summary = daySummary(u, d);
  const rows = sessionsForDate(u.id, d);
  const image = await renderReportImage(summary, u.timezone, rows);

  // PART 1 — image
  const form = new FormData();
  form.append("chat_id", u.telegram_channel_id);
  form.append(
    "photo",
    new Blob([new Uint8Array(image)], { type: "image/png" }),
    "focusarc.png"
  );
  await tg(u.telegram_bot_token, "sendPhoto", form);

  // PART 2 — text
  await tg(u.telegram_bot_token, "sendMessage", {
    chat_id: u.telegram_channel_id,
    text: buildReportText(summary),
  });
}
