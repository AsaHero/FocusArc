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

/** Local time-of-day (HH:mm) at which the daily report fires. Overridable for testing. */
export const REPORT_TIME = process.env.REPORT_TIME ?? "23:59";

export const APP_NAME = "FocusArc";
