import { useEffect } from "react";
import { motion } from "framer-motion";
import { DateTime } from "luxon";
import { useStore } from "../store";
import "./shared.css";

const LINES = [
  "One session at a time.",
  "The quiet hours are yours.",
  "Begin where you are.",
  "Small focus, steady arc.",
  "Let the work be calm.",
];

function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

export function Greeting() {
  const name = useStore((s) => s.settings?.name ?? "");
  const dismiss = useStore((s) => s.dismissGreeting);

  // Auto-advance after ~3s; tapping anywhere also advances.
  useEffect(() => {
    const t = setTimeout(() => void dismiss(), 3200);
    return () => clearTimeout(t);
  }, [dismiss]);

  // Derived locally so the name, date, and time-of-day are always current.
  const now = DateTime.now();
  const text = timeOfDayGreeting(now.hour);
  const date = now.toFormat("LLLL d, yyyy");
  const line = LINES[now.day % LINES.length];

  return (
    <div className="screen" onClick={() => void dismiss()} style={{ cursor: "pointer" }}>
      <motion.div
        className="center-stack"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <span className="eyebrow">{date}</span>
        <h1 className="headline">
          {text}
          {name && (
            <>
              <br />
              <span className="accent">{name}</span>
            </>
          )}
        </h1>
        <p className="subtle">{line}</p>
      </motion.div>
    </div>
  );
}
