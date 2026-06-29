# FocusArc

A minimal, premium daily focus timer with a split-flap flip clock and an
automatic Telegram daily report sent at **23:59** in your local timezone.

Dark, quiet, focused — the timer is the product.

## Stack

- **client/** — React + TypeScript + Vite. Flip-clock UI, Framer Motion screen
  transitions, zustand state, `localStorage` mirror for instant reads.
- **server/** — minimal Node + Express backend (the always-on piece): the source
  of truth in SQLite (`better-sqlite3`), a server-authoritative pause/refresh-safe
  timer, the daily-report scheduler, server-side report image rendering
  (`@napi-rs/canvas`), and Telegram delivery.

The Node backend owns the midnight scheduler and Telegram sending so the report
fires reliably regardless of whether a browser tab is open.

## Run

```bash
pnpm install        # first time
pnpm dev            # starts backend (:4000) + client (:5173) together
```

Open http://localhost:5173 — Vite proxies `/api` to the backend.

Production build: `pnpm build`, then `pnpm start` (serve `client/dist` separately
or behind any static host; the backend serves the API on `:4000`).

## Telegram daily report (optional)

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token.
2. Add the bot to your channel as an admin; get the channel ID (`@name` or `-100…`).
3. In the app: **Settings → Bot token + Channel ID → Save**.
4. **Send test report** to verify. Thereafter the report fires automatically at
   23:59 your time, if you logged at least one session that day.

The report is two parts: a generated dashboard **image** (total hours, a 24-hour
session timeline, streak) and a **text** summary.

## Configuration (env, server)

| Var           | Default                 | Notes                                  |
| ------------- | ----------------------- | -------------------------------------- |
| `PORT`        | `4000`                  | Backend port                           |
| `DB_PATH`     | `server/focusarc.db`    | SQLite file (gitignored)               |
| `REPORT_TIME` | `23:59`                 | Local time-of-day the report fires     |

## Data

SQLite is the source of truth (`settings` single row, `sessions`). Telegram
credentials live only in that local DB and are never committed. `localStorage`
mirrors the latest totals for instant first paint.
