import "./PulseLine.css";

type LineState = "running" | "paused" | "stopped";

/**
 * Signature element beneath the flip clock:
 *  - running: thin gold line, opacity pulses 0.3 → 1 → 0.3
 *  - paused:  static amber line, no pulse
 *  - stopped: hidden
 */
export function PulseLine({ state }: { state: LineState }) {
  if (state === "stopped") return <div className="pulseline-spacer" />;
  return <div className={`pulseline pulseline-${state}`} />;
}
