import { useEffect, useRef, useState } from "react";
import "./FlipDigit.css";

/**
 * A single split-flap digit. When `value` changes, the top half of the new
 * value drops over the old one (a classic flip-clock card flip). Only digits
 * whose value changed animate, so the clock flips naturally and staggered.
 */
export function FlipDigit({ value }: { value: string }) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    setPrevious(prevRef.current);
    setCurrent(value);
    setFlipping(true);
    prevRef.current = value;
    const t = setTimeout(() => setFlipping(false), 320);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="flip">
      {/* Static halves showing the resolved (current) value */}
      <div className="flip-half flip-top">
        <span>{current}</span>
      </div>
      <div className="flip-half flip-bottom">
        <span>{current}</span>
      </div>
      <div className="flip-divider" />

      {flipping && (
        <>
          {/* Top of the OLD value flips down */}
          <div className="flip-half flip-top flip-anim-top" key={`t-${previous}-${current}`}>
            <span>{previous}</span>
          </div>
          {/* Bottom of the NEW value flips up into place */}
          <div className="flip-half flip-bottom flip-anim-bottom" key={`b-${previous}-${current}`}>
            <span>{current}</span>
          </div>
        </>
      )}
    </div>
  );
}
