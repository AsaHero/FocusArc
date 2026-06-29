import { DateTime } from "luxon";

/** Current local date (YYYY-MM-DD) in the given timezone. */
export function localDate(tz: string, at: number = Date.now()): string {
  return DateTime.fromMillis(at).setZone(tz).toFormat("yyyy-MM-dd");
}

/** Current local time-of-day (HH:mm) in the given timezone. */
export function localTime(tz: string, at: number = Date.now()): string {
  return DateTime.fromMillis(at).setZone(tz).toFormat("HH:mm");
}

/** The local date N days before the given local date (YYYY-MM-DD math). */
export function shiftDate(date: string, days: number): string {
  return DateTime.fromISO(date).plus({ days }).toFormat("yyyy-MM-dd");
}

/** Human date like "June 29, 2026" for a YYYY-MM-DD string. */
export function prettyDate(date: string): string {
  return DateTime.fromISO(date).toFormat("LLLL d, yyyy");
}

/** Local clock label "HH:mm" for an epoch-ms timestamp in a timezone. */
export function clockLabel(ts: number, tz: string): string {
  return DateTime.fromMillis(ts).setZone(tz).toFormat("HH:mm");
}

/** Time-of-day greeting for the given timezone. */
export function greetingFor(tz: string, at: number = Date.now()): string {
  const hour = DateTime.fromMillis(at).setZone(tz).hour;
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}
