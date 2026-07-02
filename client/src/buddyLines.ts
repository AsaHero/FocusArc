/**
 * Short reaction lines for Arc, the focus companion. Kept separate from the 77
 * focus quotes in `quotes.ts` — those are Arc's "spoken quotes"; these are its
 * own little reactions to what you're doing.
 */

export const START_LINES = [
  "Let's go.",
  "Deep breath — begin.",
  "Here we go, together.",
  "Eyes on the work.",
  "I'm right here with you.",
];

export const PAUSE_LINES = [
  "Resting is part of it.",
  "I'll wait right here.",
  "Take your moment.",
  "Breathe. Back when you're ready.",
];

export const STOP_LINES = [
  "Nice work.",
  "That counts.",
  "Well done — really.",
  "Another arc closed.",
];

export const PET_LINES = [
  "♥",
  "Hi there.",
  "You've got this.",
  "*happy wobble*",
  "Good to see you.",
];

/** Milestone lines keyed by the elapsed-ms threshold that triggers them. */
export const MILESTONE_MS = [25 * 60_000, 50 * 60_000, 60 * 60_000] as const;

export const MILESTONE_LINES: Record<number, string> = {
  [25 * 60_000]: "25 minutes in — you're rolling.",
  [50 * 60_000]: "Fifty minutes of focus. Beautiful.",
  [60 * 60_000]: "A full hour. Incredible.",
};

/** Celebration line for a streak of `n` days. */
export function streakLine(n: number): string {
  return `🔥 ${n} day${n === 1 ? "" : "s"} — keep the arc going.`;
}

/** Things Arc reads about while you focus (used in its "busy" click line). */
export const READING_TOPICS = [
  "the stars",
  "deep work",
  "old maps",
  "how rivers cut rock",
  "quiet mornings",
  "far-off places",
  "the sea",
  "focus itself",
];

/** In-character reply when you click Arc while it's busy focusing. */
export function busyLine(
  activity: "read" | "ponder" | "sleep" | "gaze" | "tea",
  topic: string,
): string {
  switch (activity) {
    case "read":
      return `Shh — I'm reading about ${topic}.`;
    case "ponder":
      return "Hmm… thinking something through. One moment.";
    case "sleep":
      return "*yawn*… five more minutes.";
    case "gaze":
      return "Look… the stars are out. Keep going.";
    case "tea":
      return "Just a sip of tea. I'm still with you.";
  }
}

/** Pick a random entry, avoiding an immediate repeat of `exclude` when possible. */
export function pick(arr: readonly string[], exclude?: string): string {
  if (arr.length <= 1) return arr[0];
  let v = arr[Math.floor(Math.random() * arr.length)];
  while (v === exclude) v = arr[Math.floor(Math.random() * arr.length)];
  return v;
}
