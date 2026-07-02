import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlipClock } from "../components/FlipClock";
import { PulseLine } from "../components/PulseLine";
import { ArcBuddy } from "../components/ArcBuddy";
import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { useStore, liveElapsed } from "../store";
import { hms, humanDuration } from "../format";
import { randomQuote } from "../quotes";
import { toggleFullscreen, useIsFullscreen } from "../fullscreen";
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

const ICON = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const PlayIcon = () => (
  <svg {...ICON} aria-hidden>
    <path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none" />
  </svg>
);
const PauseIcon = () => (
  <svg {...ICON} aria-hidden>
    <line x1="8" y1="5" x2="8" y2="19" />
    <line x1="16" y1="5" x2="16" y2="19" />
  </svg>
);
const StopIcon = () => (
  <svg {...ICON} aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const EnterFsIcon = () => (
  <svg {...ICON} aria-hidden>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
  </svg>
);
const ExitFsIcon = () => (
  <svg {...ICON} aria-hidden>
    <path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4" />
  </svg>
);

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;

export function Timer() {
  const { active, today, anchorAt, start, pause, resume, stop, endDay, setPhase } = useStore();
  const running = active?.state === "running";
  const now = useNow(running);
  const fullscreen = useIsFullscreen();
  const streak = today?.streak ?? 0;
  const canEndDay = (today?.sessions?.length ?? 0) > 0 || !!active;

  // Motivational line: a fresh quote each time the clock is started, and an
  // automatic rotation once an hour otherwise.
  const [quote, setQuote] = useState(() => randomQuote());

  useEffect(() => {
    const id = setInterval(() => setQuote((q) => randomQuote(q)), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const startedRef = useRef(!!active);
  useEffect(() => {
    const running = !!active;
    // Pick a new quote on the transition from idle → an active session, which
    // also covers keyboard (Space) starts that bypass the button handler.
    if (running && !startedRef.current) setQuote((q) => randomQuote(q));
    startedRef.current = running;
  }, [active]);

  const elapsed = active ? liveElapsed({ active, anchorAt }, now) : 0;
  const { h, m, s } = hms(elapsed);

  // Completed sessions are fixed; the active one ticks live.
  const doneMs = (today?.sessions ?? [])
    .filter((x) => x.state === "done")
    .reduce((sum, x) => sum + x.durationMs, 0);
  const todayMs = doneMs + (active ? elapsed : 0);

  const lineState = active ? (running ? "running" : "paused") : "stopped";

  return (
    <div className={`screen timer-screen${running ? " ambient" : ""}`}>
      <header className="timer-header">
        <div className="timer-brand">
          <Logo size={22} />
          <span className="timer-wordmark">FocusArc</span>
        </div>
        <nav className="timer-actions">
          <button className="timer-navbtn" onClick={() => setPhase("history")}>
            History
          </button>
          <button className="timer-navbtn" onClick={() => setPhase("settings")}>
            Settings
          </button>
          <button
            className="timer-fs"
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <ExitFsIcon /> : <EnterFsIcon />}
          </button>
        </nav>
      </header>

      {/* Arc now presents the quote in its speech bubble; keep the line for
          screen readers so the rotation logic stays accessible. */}
      <p className="timer-quote sr-only">“{quote}”</p>

      <div className="timer-stage">
        <FlipClock h={h} m={m} s={s} />
        <PulseLine state={lineState} />
      </div>

      <div className="timer-today">
        Today · <span className="accent">{humanDuration(todayMs)}</span>
        {streak > 0 && <span className="muted"> · 🔥 {streak}d</span>}
      </div>

      <div className="timer-controls">
        {!active ? (
          <Button variant="solid" onClick={() => void start()}>
            <PlayIcon /> Start
          </Button>
        ) : (
          <>
            {running ? (
              <Button variant="ghost" onClick={() => void pause()}>
                <PauseIcon /> Pause
              </Button>
            ) : (
              <Button variant="solid" onClick={() => void resume()}>
                <PlayIcon /> Resume
              </Button>
            )}
            <Button variant="ghost" onClick={() => void stop()}>
              <StopIcon /> Stop
            </Button>
          </>
        )}
      </div>

      <div className="timer-hints">
        {!active ? (
          <span><Kbd>Space</Kbd> start</span>
        ) : (
          <>
            <span><Kbd>Space</Kbd> {running ? "pause" : "resume"}</span>
            <span><Kbd>S</Kbd> stop</span>
          </>
        )}
        <span><Kbd>F</Kbd> fullscreen</span>
      </div>

      {canEndDay && (
        <button className="timer-endday" onClick={() => void endDay()}>
          End day{" "}
          <span className="muted">
            — wrap up{useStore.getState().settings?.telegramConfigured ? " & send report" : ""}
          </span>
        </button>
      )}

      <ArcBuddy
        sessionState={lineState === "stopped" ? "idle" : lineState}
        elapsedMs={elapsed}
        streak={streak}
        quote={quote}
      />
    </div>
  );
}
