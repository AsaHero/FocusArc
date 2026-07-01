import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, type Phase } from "./store";
import { useDocumentTitle } from "./useDocumentTitle";
import { toggleFullscreen } from "./fullscreen";
import { readCache } from "./cache";
import { Splash } from "./screens/Splash";
import { Auth } from "./screens/Auth";
import { Greeting } from "./screens/Greeting";
import { Timer } from "./screens/Timer";
import { SessionEnd } from "./screens/SessionEnd";
import { Settings } from "./screens/Settings";
import { Account } from "./screens/Account";
import { History } from "./screens/History";

// Returning users (we have a cached session) get a brief splash; first-ever
// boots get the full branded dwell.
const SPLASH_MS = readCache() ? 600 : 2000;

const SCREENS: Record<Phase, () => JSX.Element> = {
  splash: Splash,
  auth: Auth,
  greeting: Greeting,
  timer: Timer,
  sessionEnd: SessionEnd,
  settings: Settings,
  account: Account,
  history: History,
};

export default function App() {
  const phase = useStore((s) => s.phase);
  const boot = useStore((s) => s.boot);
  const setPhase = useStore((s) => s.setPhase);

  useDocumentTitle();

  // Load data + hold the splash for a minimum dwell, then reveal the app.
  useEffect(() => {
    let cancelled = false;
    const minSplash = new Promise((r) => setTimeout(r, SPLASH_MS));
    Promise.all([boot(), minSplash]).then(() => {
      if (cancelled) return;
      if (useStore.getState().phase === "splash") {
        setPhase(useStore.getState().bootTarget);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boot, setPhase]);

  // Global keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;

      const s = useStore.getState();
      if (!s.authed) return;

      if (e.key === "Escape") {
        if (s.phase === "settings" || s.phase === "account" || s.phase === "history") {
          e.preventDefault();
          s.setPhase("timer");
        }
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      // Session controls only make sense on the timer screen.
      if (s.phase !== "timer") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!s.active) void s.start();
        else if (s.active.state === "running") void s.pause();
        else void s.resume();
      } else if (e.key === "s" || e.key === "S") {
        if (s.active) {
          e.preventDefault();
          void s.stop();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Screen = SCREENS[phase];

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
