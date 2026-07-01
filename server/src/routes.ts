import { Router, type Response } from "express";
import {
  createUser,
  getUser,
  getUserByName,
  publicUser,
  updateUser,
  changePassword,
  deleteUser,
  markGreetingSeen,
  currentFocusDate,
  closeFocusDay,
} from "./users.js";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  userIdForRefresh,
  revokeRefreshToken,
  requireAuth,
  verifyPassword,
  verifyAccessToken,
  type AuthedRequest,
} from "./auth.js";
import { subscribe, broadcast } from "./events.js";
import {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getActiveSession,
  daySummary,
  history,
  elapsedMs,
  maybeAutoCloseFocusDay,
  type SessionRow,
} from "./sessions.js";
import { sendReport } from "./report/telegram.js";
import { greetingFor, prettyDate } from "./time.js";

export const router = Router();

const NAME_RE = /^[a-zA-Z0-9_.-]{2,40}$/;

function activeView(s: SessionRow) {
  return { id: s.id, state: s.state, elapsedMs: elapsedMs(s), startTs: s.start_ts };
}

function activePayload(userId: number) {
  const a = getActiveSession(userId);
  return a ? activeView(a) : null;
}

/** Push the user's current active session + today summary to their devices. */
function broadcastState(userId: number) {
  broadcast(userId, { active: activePayload(userId), today: daySummary(getUser(userId)!) });
}

/** Issue a fresh access+refresh pair and return the standard auth response. */
function authResponse(res: Response, userId: number) {
  const u = getUser(userId)!;
  res.json({
    accessToken: signAccessToken(userId),
    refreshToken: issueRefreshToken(userId),
    user: publicUser(u),
  });
}

// ---- public auth routes ----------------------------------------------------

router.post("/auth/register", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const password = String(req.body?.password ?? "");
  const timezone = String(req.body?.timezone ?? "UTC");
  if (!NAME_RE.test(name)) {
    return res.status(400).json({ error: "Name must be 2–40 letters, digits, . _ or -" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (getUserByName(name)) {
    return res.status(409).json({ error: "That name is taken" });
  }
  const u = createUser(name, password, timezone);
  return authResponse(res, u.id);
});

router.post("/auth/login", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const password = String(req.body?.password ?? "");
  const u = getUserByName(name);
  if (!u || !verifyPassword(password, u.password_hash)) {
    return res.status(401).json({ error: "Invalid name or password" });
  }
  return authResponse(res, u.id);
});

router.post("/auth/refresh", (req, res) => {
  const raw = String(req.body?.refreshToken ?? "");
  const userId = userIdForRefresh(raw);
  if (userId == null) return res.status(401).json({ error: "Invalid refresh token" });
  const next = rotateRefreshToken(raw);
  if (!next) return res.status(401).json({ error: "Invalid refresh token" });
  res.json({
    accessToken: signAccessToken(userId),
    refreshToken: next,
    user: publicUser(getUser(userId)!),
  });
});

router.post("/auth/logout", (req, res) => {
  const raw = String(req.body?.refreshToken ?? "");
  if (raw) revokeRefreshToken(raw);
  res.json({ ok: true });
});

/**
 * Real-time state stream (SSE). EventSource can't send an Authorization header,
 * so the short-lived access token comes in as a query param and is verified
 * here. The client refreshes the token and reconnects when it expires.
 */
router.get("/events", (req, res) => {
  const token = String(req.query.token ?? "");
  const userId = token ? verifyAccessToken(token) : null;
  if (userId == null) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  subscribe(userId, res);

  // Prime the connection with the current state so a fresh subscriber is
  // immediately consistent without waiting for the next mutation.
  broadcastState(userId);
});

// ---- everything below requires authentication ------------------------------

router.use(requireAuth);

router.get("/auth/me", (req: AuthedRequest, res) => {
  res.json({ user: publicUser(getUser(req.userId!)!) });
});

/** One call that powers the initial client render. */
router.get("/bootstrap", (req: AuthedRequest, res) => {
  // Close a stale (>24h) focus day on open, not just on the next Start.
  maybeAutoCloseFocusDay(getUser(req.userId!)!);
  const u = getUser(req.userId!)!;
  const focus = currentFocusDate(u);
  const greetingDue = u.onboarded === 1 && u.last_greeting_date !== focus;
  res.json({
    settings: publicUser(u),
    today: daySummary(u, focus),
    active: activePayload(u.id),
    greeting: {
      due: greetingDue,
      text: greetingFor(u.timezone),
      name: u.name,
      date: prettyDate(focus),
    },
  });
});

router.put("/settings", (req: AuthedRequest, res) => {
  const { timezone, telegramBotToken, telegramChannelId } = req.body ?? {};
  updateUser(req.userId!, { timezone, telegramBotToken, telegramChannelId });
  res.json({ settings: publicUser(getUser(req.userId!)!) });
});

router.post("/greeting/seen", (req: AuthedRequest, res) => {
  const u = getUser(req.userId!)!;
  markGreetingSeen(u.id, currentFocusDate(u));
  res.json({ ok: true });
});

router.post("/sessions/start", (req: AuthedRequest, res) => {
  const s = startSession(req.userId!);
  res.json({ active: activeView(s) });
  broadcastState(req.userId!);
});

router.post("/sessions/pause", (req: AuthedRequest, res) => {
  const s = pauseSession(req.userId!, Number(req.body?.id));
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({ active: activeView(s) });
  broadcastState(req.userId!);
});

router.post("/sessions/resume", (req: AuthedRequest, res) => {
  const s = resumeSession(req.userId!, Number(req.body?.id));
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({ active: activeView(s) });
  broadcastState(req.userId!);
});

router.post("/sessions/stop", (req: AuthedRequest, res) => {
  const s = stopSession(req.userId!, Number(req.body?.id));
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({
    session: { id: s.id, durationMs: elapsedMs(s) },
    today: daySummary(getUser(req.userId!)!),
  });
  broadcastState(req.userId!);
});

router.get("/today", (req: AuthedRequest, res) => {
  res.json({ today: daySummary(getUser(req.userId!)!) });
});

router.get("/history", (req: AuthedRequest, res) => {
  res.json({ history: history(getUser(req.userId!)!) });
});

/** Sessions for a single past focus day (for the history drill-down). */
router.get("/history/day/:date", (req: AuthedRequest, res) => {
  const date = String(req.params.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Bad date" });
  }
  res.json({ day: daySummary(getUser(req.userId!)!, date) });
});

/** Manually send the report for the current focus day. */
router.post("/report/send", async (req: AuthedRequest, res) => {
  try {
    await sendReport(req.userId!);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * End the focus day: stop any active session, send the report (best-effort if
 * Telegram is configured), then close the focus day so the streak locks in.
 */
router.post("/day/end", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const active = getActiveSession(userId);
  if (active) stopSession(userId, active.id);

  const u = getUser(userId)!;
  const focus = currentFocusDate(u);
  const summary = daySummary(u, focus);

  let reportSent = false;
  let reportError: string | undefined;
  if (u.telegram_bot_token && u.telegram_channel_id) {
    try {
      await sendReport(userId, focus);
      reportSent = true;
    } catch (err) {
      reportError = (err as Error).message;
    }
  }

  closeFocusDay(userId);
  res.json({ today: summary, reportSent, reportError });
  broadcastState(userId);
});

// ---- account ---

router.put("/account/password", (req: AuthedRequest, res) => {
  const current = String(req.body?.current ?? "");
  const next = String(req.body?.next ?? "");
  const u = getUser(req.userId!)!;
  if (!verifyPassword(current, u.password_hash)) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }
  if (next.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  changePassword(u.id, next);
  res.json({ ok: true });
});

router.delete("/account", (req: AuthedRequest, res) => {
  deleteUser(req.userId!);
  res.json({ ok: true });
});
