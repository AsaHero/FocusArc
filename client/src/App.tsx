import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, type Phase } from "./store";
import { Splash } from "./screens/Splash";
import { Auth } from "./screens/Auth";
import { Greeting } from "./screens/Greeting";
import { Timer } from "./screens/Timer";
import { SessionEnd } from "./screens/SessionEnd";
import { Settings } from "./screens/Settings";
import { Account } from "./screens/Account";
import { History } from "./screens/History";

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

  // Load data + hold the splash for a minimum dwell, then reveal the app.
  useEffect(() => {
    let cancelled = false;
    const minSplash = new Promise((r) => setTimeout(r, 2000));
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
