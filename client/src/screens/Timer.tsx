import { useEffect, useState } from "react";
import { FlipClock } from "../components/FlipClock";
import { PulseLine } from "../components/PulseLine";
import { Button } from "../components/Button";
import { useStore, liveElapsed } from "../store";
import { hms, humanDuration } from "../format";
import "./Timer.css";

/** Re-render roughly 4x/second so the seconds digit stays crisp. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Timer() {
  const { active, today, anchorAt, start, pause, resume, stop, setPhase } = useStore();
  const running = active?.state === "running";
  const now = useNow(running);

  const elapsed = active ? liveElapsed({ active, anchorAt }, now) : 0;
  const { h, m, s } = hms(elapsed);

  // Completed sessions are fixed; the active one ticks live.
  const doneMs = (today?.sessions ?? [])
    .filter((x) => x.state === "done")
    .reduce((sum, x) => sum + x.durationMs, 0);
  const todayMs = doneMs + (active ? elapsed : 0);

  const lineState = active ? (running ? "running" : "paused") : "stopped";

  return (
    <div className="screen timer-screen">
      <div className="timer-stage">
        <FlipClock h={h} m={m} s={s} />
        <PulseLine state={lineState} />
      </div>

      <div className="timer-today">
        Today · <span className="accent">{humanDuration(todayMs)}</span>
      </div>

      <div className="timer-controls">
        {!active ? (
          <>
            <Button variant="solid" onClick={() => void start()}>
              Start
            </Button>
            <Button variant="quiet" onClick={() => setPhase("settings")}>
              Settings
            </Button>
          </>
        ) : (
          <>
            {running ? (
              <Button variant="ghost" onClick={() => void pause()}>
                Pause
              </Button>
            ) : (
              <Button variant="solid" onClick={() => void resume()}>
                Resume
              </Button>
            )}
            <Button variant="ghost" onClick={() => void stop()}>
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
