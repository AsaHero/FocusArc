import { Router } from "express";
import {
  publicSettings,
  getSettings,
  updateSettings,
  completeOnboarding,
  markGreetingSeen,
} from "./settings.js";
import {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getActiveSession,
  getSession,
  daySummary,
  elapsedMs,
} from "./sessions.js";
import { sendReport } from "./report/telegram.js";
import { localDate, greetingFor, prettyDate } from "./time.js";

export const router = Router();

function activePayload() {
  const a = getActiveSession();
  if (!a) return null;
  return { id: a.id, state: a.state, elapsedMs: elapsedMs(a), startTs: a.start_ts };
}

/** One call that powers the initial client render. */
router.get("/bootstrap", (_req, res) => {
  const s = getSettings();
  const today = localDate(s.timezone);
  const greetingDue = s.onboarded === 1 && s.last_greeting_date !== today;
  res.json({
    settings: publicSettings(),
    today: daySummary(today),
    active: activePayload(),
    greeting: {
      due: greetingDue,
      text: greetingFor(s.timezone),
      name: s.name,
      date: prettyDate(today),
    },
  });
});

router.put("/settings", (req, res) => {
  const { name, timezone, telegramBotToken, telegramChannelId } = req.body ?? {};
  updateSettings({ name, timezone, telegramBotToken, telegramChannelId });
  res.json({ settings: publicSettings() });
});

router.post("/onboarding", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const timezone = String(req.body?.timezone ?? "UTC");
  if (!name) return res.status(400).json({ error: "Name is required" });
  completeOnboarding(name, timezone);
  res.json({ settings: publicSettings() });
});

router.post("/greeting/seen", (_req, res) => {
  markGreetingSeen(localDate(getSettings().timezone));
  res.json({ ok: true });
});

router.post("/sessions/start", (_req, res) => {
  const s = startSession();
  res.json({ active: { id: s.id, state: s.state, elapsedMs: elapsedMs(s), startTs: s.start_ts } });
});

router.post("/sessions/pause", (req, res) => {
  const id = Number(req.body?.id);
  const s = pauseSession(id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({ active: { id: s.id, state: s.state, elapsedMs: elapsedMs(s), startTs: s.start_ts } });
});

router.post("/sessions/resume", (req, res) => {
  const id = Number(req.body?.id);
  const s = resumeSession(id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({ active: { id: s.id, state: s.state, elapsedMs: elapsedMs(s), startTs: s.start_ts } });
});

router.post("/sessions/stop", (req, res) => {
  const id = Number(req.body?.id);
  const s = stopSession(id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({
    session: { id: s.id, durationMs: elapsedMs(s) },
    today: daySummary(),
  });
});

router.get("/today", (_req, res) => {
  res.json({ today: daySummary() });
});

router.post("/report/test", async (_req, res) => {
  try {
    await sendReport();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
