/** Static FocusArc arc mark — the ring, a partial accent arc, and a center dot.
 *  (The animated version lives in the Splash screen.) */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 92 92" fill="none" aria-hidden>
      <circle cx="46" cy="46" r="40" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx="46"
        cy="46"
        r="40"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="0.72 1"
        transform="rotate(-90 46 46)"
      />
      <circle cx="46" cy="46" r="9" fill="var(--accent)" />
    </svg>
  );
}
