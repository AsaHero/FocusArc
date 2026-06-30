import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DateTime } from "luxon";
import { FONTS_DIR, APP_NAME } from "../config.js";
import { elapsedMs } from "../sessions.js";
import type { DaySummary, SessionRow } from "../sessions.js";
import { prettyDate } from "../time.js";

// Palette (mirrors the client theme).
const BG = "#080808";
const SURFACE = "#141414";
const BORDER = "#1E1E1E";
const TEXT = "#F5F5F5";
const ACCENT = "#C9A84C";
const MUTED = "#555555";

let fontsReady = false;
let monoFamily = "monospace";
let uiFamily = "sans-serif";

function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const mono = resolve(FONTS_DIR, "JetBrainsMono-Bold.ttf");
  const ui = resolve(FONTS_DIR, "Inter-Regular.ttf");
  const uiMed = resolve(FONTS_DIR, "Inter-Medium.ttf");
  if (existsSync(mono)) {
    GlobalFonts.registerFromPath(mono, "JetBrains Mono");
    monoFamily = "JetBrains Mono";
  }
  if (existsSync(ui)) {
    GlobalFonts.registerFromPath(ui, "Inter");
    uiFamily = "Inter";
  }
  if (existsSync(uiMed)) GlobalFonts.registerFromPath(uiMed, "Inter Medium");
}

function fmtHours(ms: number): string {
  const hours = ms / 3_600_000;
  // e.g. 4.5h — one decimal, trim trailing .0
  const s = hours.toFixed(1);
  return `${s.endsWith(".0") ? s.slice(0, -2) : s}h`;
}

/** Render the daily report as a 1080×1080 PNG buffer. PART 1 of the report. */
export async function renderReportImage(
  summary: DaySummary,
  tz: string,
  rows: SessionRow[]
): Promise<Buffer> {
  ensureFonts();

  const W = 1080;
  const H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const pad = 80;

  // App name (top-left)
  ctx.fillStyle = TEXT;
  ctx.font = `500 40px "${uiFamily}"`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(APP_NAME, pad, pad + 20);

  // Date (top-right)
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px "${uiFamily}"`;
  ctx.textAlign = "right";
  ctx.fillText(prettyDate(summary.date), W - pad, pad + 16);

  // Big centered total hours
  ctx.textAlign = "center";
  ctx.fillStyle = TEXT;
  ctx.font = `700 320px "${monoFamily}"`;
  ctx.fillText(fmtHours(summary.totalMs), W / 2, H / 2 + 40);

  // Accent underline beneath the number
  const lineW = 320;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lineW / 2, H / 2 + 110);
  ctx.lineTo(W / 2 + lineW / 2, H / 2 + 110);
  ctx.stroke();

  // Caption
  ctx.fillStyle = MUTED;
  ctx.font = `400 28px "${uiFamily}"`;
  ctx.fillText("focused today", W / 2, H / 2 + 165);

  // 24h timeline bar of sessions
  drawTimeline(ctx, rows, tz, pad, H - 240, W - pad * 2);

  // Streak badge (bottom-right)
  drawStreakBadge(ctx, summary.streak, W - pad, H - 90);

  return canvas.toBuffer("image/png");
}

function drawTimeline(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  rows: SessionRow[],
  tz: string,
  x: number,
  y: number,
  width: number
) {
  const barH = 18;
  const dayMs = 24 * 3_600_000;

  // Track
  ctx.fillStyle = SURFACE;
  roundRect(ctx, x, y, width, barH, barH / 2);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, barH, barH / 2);
  ctx.stroke();

  // Segments — positioned by start/end time of day
  ctx.fillStyle = ACCENT;
  for (const s of rows) {
    const startDt = DateTime.fromMillis(s.start_ts).setZone(tz);
    const startFrac = (startDt.hour * 3600 + startDt.minute * 60 + startDt.second) * 1000 / dayMs;
    const durFrac = Math.max(elapsedMs(s) / dayMs, 0.004); // min visible width
    const segX = x + startFrac * width;
    const segW = Math.min(durFrac * width, x + width - segX);
    roundRect(ctx, segX, y, Math.max(segW, 3), barH, barH / 2);
    ctx.fill();
  }

  // Hour ticks (0,6,12,18,24)
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px "${uiFamily === "monospace" ? "monospace" : uiFamily}"`;
  ctx.textAlign = "center";
  for (const h of [0, 6, 12, 18, 24]) {
    const tx = x + (h / 24) * width;
    ctx.fillText(h === 24 ? "24h" : `${h}`, tx, y + barH + 36);
  }
}

function drawStreakBadge(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  streak: number,
  rightX: number,
  centerY: number
) {
  // "N days" text, right-aligned, with a vector flame to its left.
  const label = `${streak} day${streak === 1 ? "" : "s"}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = TEXT;
  ctx.font = `700 40px "${monoFamily}"`;
  ctx.fillText(label, rightX, centerY);
  ctx.textBaseline = "alphabetic";

  const textW = ctx.measureText(label).width;
  drawFlame(ctx, rightX - textW - 56, centerY, 34);
}

/** A small gold vector flame centered at (cx, cy) with the given height. */
function drawFlame(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  cx: number,
  cy: number,
  h: number
) {
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const w = h * 0.62;
  ctx.save();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(cx, top); // tip
  ctx.bezierCurveTo(cx + w * 0.9, top + h * 0.35, cx + w * 0.7, bottom, cx, bottom);
  ctx.bezierCurveTo(cx - w * 0.7, bottom, cx - w * 0.9, top + h * 0.4, cx - w * 0.1, top + h * 0.45);
  ctx.bezierCurveTo(cx - w * 0.2, top + h * 0.2, cx - w * 0.05, top + h * 0.1, cx, top);
  ctx.closePath();
  ctx.fill();
  // Inner cut-out for a hint of depth
  ctx.fillStyle = BG;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + w * 0.4, cy + h * 0.1, cx + w * 0.3, bottom - h * 0.05, cx, bottom - h * 0.05);
  ctx.bezierCurveTo(cx - w * 0.3, bottom - h * 0.05, cx - w * 0.35, cy + h * 0.1, cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
