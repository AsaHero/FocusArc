import { FlipDigit } from "./FlipDigit";
import "./FlipClock.css";

/** HH:MM:SS split-flap display. Each digit flips independently on change. */
export function FlipClock({ h, m, s }: { h: string; m: string; s: string }) {
  return (
    <div className="flipclock">
      <FlipDigit value={h[0]} />
      <FlipDigit value={h[1]} />
      <span className="flip-colon">:</span>
      <FlipDigit value={m[0]} />
      <FlipDigit value={m[1]} />
      <span className="flip-colon">:</span>
      <FlipDigit value={s[0]} />
      <FlipDigit value={s[1]} />
    </div>
  );
}
