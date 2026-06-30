# FocusArc

A minimal, premium daily focus timer with a split-flap flip clock, per-user
accounts, day-based focus streaks, and an on-demand Telegram daily report.

Dark, quiet, focused — the timer is the product.

## Stack

- **client/** — React + TypeScript + Vite. Flip-clock UI, Framer Motion screen
  transitions, zustand state, `localStorage` mirror for instant reads.
- **server/** — minimal Node + Express backend: the source of truth in SQLite
  (`better-sqlite3`), username/password auth (scrypt + JWT access/refresh tokens),
  a server-authoritative pause/refresh-safe timer, server-side report image
  rendering (`@napi-rs/canvas`), and Telegram delivery.

## Accounts & streaks

- **Sign up with a unique name + password.** Each user gets private sessions,
  streak, and Telegram config. Tokens live in `localStorage`.
- **Focus days, not calendar days.** Work counts toward the *focus day* you
  started — late-night sessions that cross midnight stay on the same day. You
  close a focus day with the **End day** button (which also sends the report).
  A focus day left open for >24h auto-closes as a safety net.
- **Streak** = consecutive focus days with at least one completed session.
- **History** screen: a focus-hours heatmap plus current streak, longest streak,
  and lifetime total.

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
4. **Send report now** to verify. After that, reports are **manual**: tapping
   **End day** (or **Send report now**) delivers the current focus day's report.
   There is no automatic scheduler.

The report is two parts: a generated dashboard **image** (total hours, a 24-hour
session timeline, streak) and a **text** summary.

## Configuration (env, server)

| Var          | Default                | Notes                                          |
| ------------ | ---------------------- | ---------------------------------------------- |
| `PORT`       | `4000`                 | Backend port                                   |
| `DB_PATH`    | `server/focusarc.db`   | SQLite file (gitignored)                       |
| `JWT_SECRET` | dev default (insecure) | Signs access tokens — set in production         |

## Data

SQLite is the source of truth (`users`, `sessions`, `refresh_tokens`). Passwords
are scrypt-hashed; per-user Telegram credentials live only in the local DB and
are never committed. `localStorage` holds the auth tokens and a mirror of the
latest totals for instant first paint.
