import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Project root for the server package (one level up from src/). */
export const SERVER_ROOT = resolve(__dirname, "..");

export const PORT = Number(process.env.PORT ?? 4000);

/** SQLite file path. Lives next to the server package. */
export const DB_PATH = process.env.DB_PATH ?? resolve(SERVER_ROOT, "focusarc.db");

/** Bundled fonts used by the canvas report renderer. */
export const FONTS_DIR = resolve(SERVER_ROOT, "assets", "fonts");

/** Built frontend (served in production as a single unit). */
export const CLIENT_DIST = process.env.CLIENT_DIST ?? resolve(SERVER_ROOT, "..", "client", "dist");

/** Secret used to sign access-token JWTs. MUST be set in production. */
export const JWT_SECRET = process.env.JWT_SECRET ?? "focusarc-dev-secret-change-me";
if (JWT_SECRET === "focusarc-dev-secret-change-me" && process.env.NODE_ENV === "production") {
  console.warn("[config] JWT_SECRET is unset — using the insecure dev default. Set JWT_SECRET.");
}

/** Access tokens are short-lived; refresh tokens are rotated and revocable. */
export const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** A focus day left open this long is auto-closed on the next start/bootstrap. */
export const FOCUS_DAY_MAX_MS = 24 * 60 * 60 * 1000;

export const APP_NAME = "FocusArc";
