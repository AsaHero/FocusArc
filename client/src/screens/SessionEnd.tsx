import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { useStore } from "../store";
import { humanDuration } from "../format";
import "./SessionEnd.css";

export function SessionEnd() {
  const { today, lastSessionMs, start, setPhase } = useStore();
  const sessions = today?.sessions ?? [];

  return (
    <div className="screen end-screen">
      <motion.div
        className="end-stack"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="end-head">
          <span className="eyebrow">Session complete</span>
          <div className="end-session-dur mono">{humanDuration(lastSessionMs ?? 0)}</div>
        </div>

        <div className="end-timeline">
          {sessions.map((s) => (
            <div className="end-row" key={s.id}>
              <span className="end-row-time mono">
                {s.start} – {s.end ?? "…"}
              </span>
              <span className="end-row-dur mono">{humanDuration(s.durationMs)}</span>
            </div>
          ))}
        </div>

        <div className="end-totals">
          <div className="end-total">
            <span className="end-total-label">Total today</span>
            <span className="end-total-value mono">{humanDuration(today?.totalMs ?? 0)}</span>
          </div>
          <div className="end-streak">
            <FlameIcon />
            <span className="mono">{today?.streak ?? 0}</span>
            <span className="end-streak-label">
              day{(today?.streak ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="row">
          <Button variant="ghost" onClick={() => setPhase("timer")}>
            Done for today
          </Button>
          <Button variant="solid" onClick={() => void start()}>
            Keep going
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden>
      <path
        d="M9 1C9 1 3 6 3 13a6 6 0 0 0 12 0c0-3-2-5-2-5s-1 2-2.5 2C9 10 11 6 9 1Z"
        fill="var(--accent)"
      />
    </svg>
  );
}
