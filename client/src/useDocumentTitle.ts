import { useEffect, useState } from "react";
import { useStore, liveElapsed } from "./store";
import { hmsClock } from "./format";

const BASE_TITLE = "FocusArc";

/**
 * Reflect the active session's live elapsed time in the browser tab title
 * (`FocusArc — HH:MM:SS`), globally — regardless of which screen is showing.
 * Ticks once a second only while running; resets to the base title otherwise.
 */
export function useDocumentTitle(): void {
  const active = useStore((s) => s.active);
  const anchorAt = useStore((s) => s.anchorAt);
  const running = active?.state === "running";
  const [, force] = useState(0);

  // Re-render once per second while running so the seconds stay fresh.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!active) {
      document.title = BASE_TITLE;
      return;
    }
    document.title = `${BASE_TITLE} — ${hmsClock(liveElapsed({ active, anchorAt }, Date.now()))}`;
  });

  // Restore the base title when the app unmounts.
  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);
}
