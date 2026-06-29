import { motion } from "framer-motion";
import "./Splash.css";

/** ~2s animated logo, then the parent advances the flow. */
export function Splash() {
  return (
    <div className="screen splash">
      <motion.div
        className="splash-logo"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <svg width="92" height="92" viewBox="0 0 92 92" fill="none">
          <circle cx="46" cy="46" r="40" stroke="var(--border)" strokeWidth="3" />
          <motion.circle
            cx="46"
            cy="46"
            r="40"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            initial={{ strokeDashoffset: 1, rotate: -90 }}
            animate={{ strokeDashoffset: 0.28 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            style={{ transformOrigin: "center", rotate: "-90deg" }}
          />
          <circle cx="46" cy="46" r="5" fill="var(--accent)" />
        </svg>
      </motion.div>
      <motion.h1
        className="splash-name"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
      >
        FocusArc
      </motion.h1>
    </div>
  );
}
