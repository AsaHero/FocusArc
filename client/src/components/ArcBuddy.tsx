import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import gsap from "gsap";
import { SpeechBubble, type BubbleTone } from "./SpeechBubble";
import {
  START_LINES,
  PAUSE_LINES,
  STOP_LINES,
  PET_LINES,
  MILESTONE_MS,
  MILESTONE_LINES,
  READING_TOPICS,
  streakLine,
  busyLine,
  pick,
} from "../buddyLines";
import "./ArcBuddy.css";

export type SessionState = "idle" | "running" | "paused";

/** Quiet things Arc does while you focus; rotates every so often. */
type Activity = "read" | "ponder" | "sleep" | "gaze" | "tea";
const ACTIVITIES: Activity[] = ["read", "ponder", "sleep", "gaze", "tea"];

type Mood =
  | "idle"
  | "paused"
  | Activity
  | "cheer"
  | "applaud"
  | "celebrate"
  | "petJump"
  | "petSpin"
  | "petWiggle";

/** The three randomised reactions to a click/pet (when Arc is free). */
const PET_MOVES: Mood[] = ["petJump", "petSpin", "petWiggle"];

/** Moods that wear the happy face (big smile, ^^ eyes, raised waving arms). */
const HAPPY = new Set<Mood>(["cheer", "applaud", "celebrate", "petJump", "petSpin", "petWiggle"]);

interface Reaction {
  text: string;
  tone: BubbleTone;
}
interface Particle {
  id: number;
  kind: "heart" | "spark";
  dx: number;
}

/** Gross body gestures per mood. Arc stands on its legs; a small idle hop keeps
    it lively without floating. Reactions bounce; focus activities are subtle. */
const figureVariants: Variants = {
  idle: {
    x: 0,
    scaleX: 1,
    y: [0, 0, -7, 0, 0],
    rotate: 0,
    scale: 1,
    transition: { duration: 4, times: [0, 0.72, 0.8, 0.88, 1], repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" },
  },
  paused: { x: 0, scaleX: 1, y: 0, rotate: [0, -3.5, 3.5, 0], scale: 1, transition: { rotate: { duration: 3, repeat: Infinity, ease: "easeInOut" } } },
  // focus activities
  read: { x: 0, scaleX: 1, y: 0, rotate: 0, scale: 0.99 },
  // pacing — the walk itself is a GSAP timeline (see the ponder effect below), so
  // Framer just holds the figure still and lets GSAP own the transforms inside.
  ponder: { x: 0, scaleX: 1, y: 0, rotate: 0, scale: 1 },
  sleep: { x: 0, scaleX: 1, y: 0, rotate: [0, 2.5, 0], scale: [1, 1.02, 1], transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } },
  gaze: { x: 0, scaleX: 1, y: 0, rotate: [0, -2, 0, 2, 0], scale: 1, transition: { duration: 7.5, repeat: Infinity, ease: "easeInOut" } },
  tea: { x: 0, scaleX: 1, y: 0, rotate: 0, scale: 1 },
  // celebrations
  cheer: { x: 0, y: [0, 6, -22, 0, -9, 0], scaleY: [1, 0.82, 1.1, 0.97, 1.02, 1], scaleX: [1, 1.16, 0.92, 1.02, 0.99, 1], transition: { duration: 0.95, ease: "easeOut" } },
  applaud: { x: 0, scaleX: 1, y: [0, -11, 0, -6, 0], scale: [1, 1.05, 1], transition: { duration: 0.85, ease: "easeOut" } },
  celebrate: { x: 0, scaleX: 1, y: [0, -16, 0, -10, 0], scale: [1, 1.1, 1], rotate: [0, -4, 4, 0], transition: { duration: 0.9, repeat: 1, ease: "easeOut" } },
  // pet reactions — squash-and-stretch jump, a hop-spin, and a springy wiggle
  petJump: { x: 0, y: [0, 8, -26, 0, -10, 0], scaleY: [1, 0.78, 1.14, 0.95, 1.04, 1], scaleX: [1, 1.2, 0.88, 1.03, 0.98, 1], transition: { duration: 0.9, ease: "easeOut" } },
  petSpin: { x: 0, scaleX: 1, y: [0, -8, -20, -20, 0], rotate: [0, 0, 180, 372, 360], scale: [1, 1.05, 1, 1, 1], transition: { duration: 0.9, ease: "easeInOut" } },
  petWiggle: { x: 0, rotate: [0, -13, 11, -9, 6, -3, 0], scaleX: [1, 1.06, 0.96, 1.03, 1, 1, 1], transition: { duration: 0.75, ease: "easeInOut" } },
};

function mouthFor(m: Mood): string {
  if (HAPPY.has(m)) return "M38 62 Q50 77 62 62";
  if (m === "sleep" || m === "tea") return "M46 66 Q50 68 54 66";
  if (m === "read" || m === "ponder" || m === "gaze") return "M45 66 Q50 68 55 66";
  return "M41 64 Q50 72 59 64"; // idle, paused
}

/**
 * Arc — a small glowing gold companion for the timer screen. Idle, it breathes,
 * blinks, and follows the cursor with its eyes. While you focus it quietly reads,
 * paces in thought, or naps — and answers in character if you interrupt it.
 */
export function ArcBuddy({
  sessionState,
  elapsedMs,
  streak,
  quote,
}: {
  sessionState: SessionState;
  elapsedMs: number;
  streak: number;
  quote: string;
}) {
  const reduced = useReducedMotion();
  const [mood, setMood] = useState<Mood>("idle");
  const [activity, setActivity] = useState<Activity>("read");
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [focusQuote, setFocusQuote] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Latest values for use inside timeouts/intervals/listeners without re-subscribing.
  const stateRef = useRef(sessionState);
  stateRef.current = sessionState;
  const quoteRef = useRef(quote);
  quoteRef.current = quote;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const reactingRef = useRef(false);
  const topicRef = useRef(READING_TOPICS[0]);

  const gestureTimer = useRef<number>();
  const reactionTimer = useRef<number>();
  const lastLine = useRef<string>();
  const pid = useRef(0);

  /** The mood Arc rests in for a given session state (no transient reaction). */
  function restingMood(): Mood {
    const s = stateRef.current;
    if (s === "running") return activityRef.current;
    if (s === "paused") return "paused";
    return "idle";
  }

  function spawn(kind: Particle["kind"], n: number) {
    if (reducedRef.current) return;
    const items: Particle[] = Array.from({ length: n }, () => ({
      id: pid.current++,
      kind,
      dx: Math.round((Math.random() * 2 - 1) * 22),
    }));
    setParticles((p) => [...p, ...items]);
  }

  /** Show a transient mood + optional bubble line, reverting to the resting mood after `hold` ms. */
  function flash(m: Mood, r: Reaction | null, hold: number) {
    window.clearTimeout(gestureTimer.current);
    window.clearTimeout(reactionTimer.current);
    reactingRef.current = true;
    setMood(m);
    if (r) {
      lastLine.current = r.text;
      setReaction(r);
      reactionTimer.current = window.setTimeout(() => setReaction(null), hold);
    }
    gestureTimer.current = window.setTimeout(() => {
      reactingRef.current = false;
      setMood(restingMood());
    }, hold);
  }

  function celebrate(text: string) {
    flash("celebrate", { text, tone: "celebrate" }, 4200);
    spawn("spark", 7);
  }

  const lastMove = useRef<Mood>();
  function pet() {
    // Busy focusing? Reply in character instead of the party, and don't disturb
    // the activity it's in the middle of.
    if (stateRef.current === "running") {
      window.clearTimeout(reactionTimer.current);
      const text = busyLine(activityRef.current, topicRef.current);
      lastLine.current = text;
      setReaction({ text, tone: "quote" });
      reactionTimer.current = window.setTimeout(() => setReaction(null), 2800);
      return;
    }
    // Otherwise: a fresh playful reaction each click.
    let move = PET_MOVES[Math.floor(Math.random() * PET_MOVES.length)];
    while (move === lastMove.current) move = PET_MOVES[Math.floor(Math.random() * PET_MOVES.length)];
    lastMove.current = move;
    const line: Reaction | null =
      Math.random() < 0.55 ? { text: pick(PET_LINES, lastLine.current), tone: "cheer" } : null;
    flash(move, line, move === "petSpin" ? 1000 : 900);
    spawn("heart", 3);
  }

  // React to session-state transitions (start / pause / resume / stop).
  const prevState = useRef(sessionState);
  const firedMs = useRef<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevState.current;
    prevState.current = sessionState;
    if (prev === sessionState) return;

    if (prev === "idle" && sessionState === "running") {
      firedMs.current.clear();
      flash("cheer", { text: pick(START_LINES, lastLine.current), tone: "cheer" }, 2600);
    } else if (sessionState === "paused") {
      flash("paused", { text: pick(PAUSE_LINES, lastLine.current), tone: "quote" }, 3200);
    } else if (prev !== "idle" && sessionState === "idle") {
      flash("applaud", { text: pick(STOP_LINES, lastLine.current), tone: "cheer" }, 2600);
    } else {
      // e.g. paused -> running (resume): settle into the current activity.
      reactingRef.current = false;
      setMood(restingMood());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState]);

  // While focusing, rotate quietly through activities (read / ponder / sleep).
  useEffect(() => {
    if (sessionState !== "running") return;
    let timer: number;
    const roll = (from?: Activity) => {
      let a = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
      while (a === from) a = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
      if (a === "read") topicRef.current = pick(READING_TOPICS, topicRef.current);
      setActivity(a);
      timer = window.setTimeout(() => roll(a), 22_000 + Math.random() * 16_000);
    };
    roll();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState]);

  // Keep the resting pose in sync with the current activity (unless mid-reaction).
  useEffect(() => {
    if (sessionState === "running" && !reactingRef.current) setMood(activity);
  }, [activity, sessionState]);

  // While pacing, one GSAP timeline drives the whole walk (kept in the SVG so it
  // never fights Framer's transform on the button): the body travels and leans,
  // pivoting at the feet; the eyes glance in phase with the lean; and a faster,
  // independent gait loop steps the legs, bobs the body, and swings the arms.
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (reduced || mood !== "ponder") return;
    const scope = svgRef.current;
    if (!scope) return;
    const ctx = gsap.context(() => {
      const D = 15; // travel, in SVG units

      // Travel + lean together, pivoting at the feet, with the eyes glancing the
      // way it walks on the same timeline (so the glance can't drift out of phase
      // with the lean). Strides are long and eased; the turn-arounds are short
      // windups where the lean/gaze flip before it sets off the other way.
      gsap
        .timeline({ repeat: -1, defaults: { ease: "power1.inOut" } })
        .to(
          ".arc-walkroot",
          {
            keyframes: [
              { x: D, rotation: 3, duration: 2.4 },
              { rotation: -3, duration: 0.7, ease: "power2.inOut" },
              { x: -D, duration: 2.7 },
              { rotation: 3, duration: 0.7, ease: "power2.inOut" },
              { x: 0, rotation: 0, duration: 2 },
            ],
            svgOrigin: "50 90",
          },
          0,
        )
        .to(
          ".arc-eyes-walk",
          {
            keyframes: [
              { x: 1.8, duration: 2.4 },
              { x: -1.8, duration: 0.7, ease: "power2.inOut" },
              { x: -1.8, duration: 2.7 },
              { x: 1.8, duration: 0.7, ease: "power2.inOut" },
              { x: 0, duration: 2 },
            ],
          },
          0,
        );

      // Gait: a fast loop, independent of where Arc is (its phase vs. travel
      // doesn't matter). Sharing GSAP's ticker keeps these locked to each other,
      // so footfall, body-bob and arm-swing stay in step.
      gsap.to(".arc-leg-l", { y: -3, rotation: -7, transformOrigin: "50% 15%", duration: 0.46, ease: "power1.inOut", repeat: -1, yoyo: true });
      gsap.to(".arc-leg-r", { y: -3, rotation: -7, transformOrigin: "50% 15%", duration: 0.46, ease: "power1.inOut", repeat: -1, yoyo: true, delay: 0.23 });
      gsap.to(".arc-torso", { y: -1.6, scaleY: 1.02, transformOrigin: "50% 100%", duration: 0.46, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.fromTo(".arc-arm-l", { rotation: 11 }, { rotation: -11, transformOrigin: "50% 12%", duration: 0.92, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.fromTo(".arc-arm-r", { rotation: -11 }, { rotation: 11, transformOrigin: "50% 12%", duration: 0.92, ease: "sine.inOut", repeat: -1, yoyo: true });
    }, scope);
    return () => ctx.revert();
  }, [mood, reduced]);

  // Eyes track the cursor while idle — written straight to the SVG, no re-render.
  const eyesRef = useRef<SVGGElement | null>(null);
  useEffect(() => {
    if (reduced) return;
    const onMove = (e: MouseEvent) => {
      const g = eyesRef.current;
      if (!g || moodRef.current !== "idle") return;
      const box = g.ownerSVGElement?.getBoundingClientRect();
      if (!box) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height * 0.42);
      const d = Math.hypot(dx, dy) || 1;
      const r = 2.6;
      g.style.transform = `translate(${((dx / d) * r).toFixed(2)}px, ${((dy / d) * r).toFixed(2)}px)`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduced]);

  // Milestone crossings during a running session (once each, reset on start).
  useEffect(() => {
    if (sessionState !== "running") return;
    for (const t of MILESTONE_MS) {
      if (elapsedMs >= t && !firedMs.current.has(t)) {
        firedMs.current.add(t);
        celebrate(MILESTONE_LINES[t]);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, sessionState]);

  // Streak celebration: once on mount if already on a streak, then on increases.
  const prevStreak = useRef(streak);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevStreak.current = streak;
      if (streak > 0) {
        const id = window.setTimeout(() => celebrate(streakLine(streak)), 900);
        return () => window.clearTimeout(id);
      }
      return;
    }
    if (streak > prevStreak.current) celebrate(streakLine(streak));
    prevStreak.current = streak;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  // Rare spoken quote while focusing, so deep work stays quiet.
  useEffect(() => {
    if (sessionState !== "running") {
      setFocusQuote(null);
      return;
    }
    let hide: number;
    const id = window.setInterval(() => {
      setFocusQuote(quoteRef.current);
      hide = window.setTimeout(() => setFocusQuote(null), 12_000);
    }, 17 * 60_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hide);
    };
  }, [sessionState]);

  useEffect(
    () => () => {
      window.clearTimeout(gestureTimer.current);
      window.clearTimeout(reactionTimer.current);
    },
    [],
  );

  // Bubble content: transient reactions win; otherwise a quiet quote when idle
  // or paused, and only the rare focus-quote while running.
  const bubbleText = reaction ? reaction.text : sessionState === "running" ? focusQuote : quote;
  const bubbleTone: BubbleTone = reaction ? reaction.tone : "quote";

  const figureClass = `arc-figure arc-${mood}${HAPPY.has(mood) ? " arc-happy" : ""}`;

  return (
    <div className={`arc-buddy${mood === "celebrate" ? " celebrating" : ""}`}>
      <SpeechBubble text={bubbleText} tone={bubbleTone} />

      <motion.button
        type="button"
        className={figureClass}
        onClick={pet}
        aria-label="Arc, your focus companion — pet"
        variants={figureVariants}
        animate={reduced ? undefined : mood}
      >
        <span className="arc-glow" aria-hidden />
        <svg className="arc-svg" viewBox="0 0 100 100" role="img" aria-label="Arc" aria-hidden ref={svgRef}>
          <defs>
            <radialGradient id="arcBody" cx="40%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#f6e19b" />
              <stop offset="52%" stopColor="#d8b85c" />
              <stop offset="100%" stopColor="#a8842f" />
            </radialGradient>
          </defs>

          {/* everything below travels together as Arc paces (GSAP moves this group) */}
          <g className="arc-walkroot">
          {/* little legs it stands on (each steps while pacing) */}
          <g className="arc-legs">
            <g className="arc-leg arc-leg-l">
              <rect x="40" y="74" width="8" height="15" rx="4" fill="#9a7a2b" />
              <ellipse cx="43" cy="90" rx="7.5" ry="3.6" fill="#836622" />
            </g>
            <g className="arc-leg arc-leg-r">
              <rect x="52" y="74" width="8" height="15" rx="4" fill="#9a7a2b" />
              <ellipse cx="57" cy="90" rx="7.5" ry="3.6" fill="#836622" />
            </g>
          </g>

          {/* arms (behind the torso so they poke out the sides) */}
          <ellipse className="arc-arm arc-arm-l" cx="21" cy="58" rx="7" ry="9" fill="url(#arcBody)" />
          <ellipse className="arc-arm arc-arm-r" cx="79" cy="58" rx="7" ry="9" fill="url(#arcBody)" />

          {/* body */}
          <ellipse className="arc-torso" cx="50" cy="50" rx="31" ry="30" fill="url(#arcBody)" />

          {/* little sprout antenna */}
          <path className="arc-antenna" d="M50 21 Q53 12 59 11" fill="none" stroke="#9a7a2b" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="60" cy="10.5" r="3.4" fill="#f6e19b" />

          {/* cheeks + face */}
          <ellipse className="arc-cheek" cx="33" cy="56" rx="4.6" ry="3" fill="#e8899a" />
          <ellipse className="arc-cheek" cx="67" cy="56" rx="4.6" ry="3" fill="#e8899a" />
          <Face mood={mood} eyesRef={eyesRef} />
          <path
            className="arc-mouth"
            d={mouthFor(mood)}
            fill="none"
            stroke="#2a2410"
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* activity props */}
          {mood === "read" && (
            <g className="arc-book">
              <path d="M31 60 L50 57 L50 73 L31 75 Z" fill="#efe6c9" stroke="#8a6d24" strokeWidth="1.5" />
              <path d="M69 60 L50 57 L50 73 L69 75 Z" fill="#e2d4ac" stroke="#8a6d24" strokeWidth="1.5" />
              <line x1="50" y1="57" x2="50" y2="73" stroke="#8a6d24" strokeWidth="1.5" />
              <line x1="35" y1="64" x2="46" y2="62.5" stroke="#c9b78a" strokeWidth="1" opacity="0.8" />
              <line x1="35" y1="68" x2="46" y2="66.5" stroke="#c9b78a" strokeWidth="1" opacity="0.8" />
              <line x1="54" y1="62.5" x2="65" y2="64" stroke="#c9b78a" strokeWidth="1" opacity="0.8" />
              <line x1="54" y1="66.5" x2="65" y2="68" stroke="#c9b78a" strokeWidth="1" opacity="0.8" />
              <ellipse cx="30" cy="74" rx="4" ry="3.4" fill="url(#arcBody)" />
              <ellipse cx="70" cy="74" rx="4" ry="3.4" fill="url(#arcBody)" />
            </g>
          )}
          {mood === "sleep" && (
            <g className="arc-zzz" fill="#f0e6c8" fontFamily="ui-monospace, monospace" fontWeight={700}>
              <text className="z1" x="65" y="30" fontSize="8">z</text>
              <text className="z2" x="71" y="22" fontSize="10">z</text>
              <text className="z3" x="78" y="13" fontSize="12">Z</text>
            </g>
          )}
          {mood === "ponder" && (
            <g className="arc-think" fill="#cdb87e">
              <circle className="t1" cx="69" cy="31" r="1.6" />
              <circle className="t2" cx="74" cy="25" r="2.1" />
              <circle className="t3" cx="80" cy="18" r="2.7" />
            </g>
          )}
          {mood === "gaze" && (
            <g className="arc-stars" fill="#f3e7b6">
              <path className="st1" d="M20 20 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 Z" />
              <path className="st2" d="M78 14 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1 Z" />
              <circle className="st3" cx="88" cy="34" r="1.5" />
              <circle className="st1" cx="12" cy="40" r="1.2" />
              <circle className="st2" cx="70" cy="30" r="1.1" />
            </g>
          )}
          {mood === "tea" && (
            <g className="arc-tea">
              {/* steam */}
              <g className="arc-steam" fill="none" stroke="#d8cba0" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
                <path className="s1" d="M60 44 q3 -4 0 -8 q-3 -4 0 -8" />
                <path className="s2" d="M66 44 q3 -4 0 -8 q-3 -4 0 -8" />
              </g>
              {/* mug + hand */}
              <path d="M57 52 h13 v7 a6.5 6.5 0 0 1 -13 0 Z" fill="#efe6c9" stroke="#8a6d24" strokeWidth="1.5" />
              <path d="M70 53 h3 a3 3 0 0 1 0 6 h-3" fill="none" stroke="#8a6d24" strokeWidth="1.5" />
              <ellipse cx="57" cy="62" rx="4" ry="3.4" fill="url(#arcBody)" />
            </g>
          )}
          </g>
        </svg>

        <span className="arc-particles" aria-hidden>
          <AnimatePresence>
            {particles.map((p) => (
              <motion.span
                key={p.id}
                className={`arc-particle arc-${p.kind}`}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], x: p.dx, y: -46, scale: 1 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                onAnimationComplete={() => setParticles((cur) => cur.filter((q) => q.id !== p.id))}
              >
                {p.kind === "heart" ? "♥" : "✦"}
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      </motion.button>
    </div>
  );
}

/** Eyes + shine, whose shape depends on mood. The open pair carries the ref so
    the cursor-tracking effect can nudge it while idle. */
function Face({ mood, eyesRef }: { mood: Mood; eyesRef: RefObject<SVGGElement> }) {
  if (HAPPY.has(mood)) {
    return (
      <g className="arc-eyes" fill="none" stroke="#2a2410" strokeWidth="2.6" strokeLinecap="round">
        <path d="M36 49 Q41 43 46 49" />
        <path d="M54 49 Q59 43 64 49" />
      </g>
    );
  }
  if (mood === "sleep") {
    return (
      <g className="arc-eyes" fill="none" stroke="#2a2410" strokeWidth="2.4" strokeLinecap="round">
        <path d="M37 48 Q41 51 45 48" />
        <path d="M55 48 Q59 51 63 48" />
      </g>
    );
  }
  if (mood === "read") {
    // looking down at the book
    return (
      <g className="arc-eyes">
        <ellipse cx="41" cy="50" rx="4.4" ry="3.2" fill="#2a2410" />
        <ellipse cx="59" cy="50" rx="4.4" ry="3.2" fill="#2a2410" />
      </g>
    );
  }
  if (mood === "tea") {
    // relaxed, content eyes
    return (
      <g className="arc-eyes" fill="none" stroke="#2a2410" strokeWidth="2.4" strokeLinecap="round">
        <path d="M37 47 Q41 50 45 47" />
        <path d="M55 47 Q59 50 63 47" />
      </g>
    );
  }
  if (mood === "ponder") {
    // walking: the same front-facing eyes as idle, but a plain group (no cursor
    // ref) so arc-glance can slide them toward the way Arc is pacing.
    return (
      <g className="arc-eyes arc-eyes-walk">
        <ellipse className="arc-eye" cx="41" cy="47" rx="5" ry="6.3" fill="#2a2410" />
        <ellipse className="arc-eye" cx="59" cy="47" rx="5" ry="6.3" fill="#2a2410" />
        <circle className="arc-shine" cx="43" cy="44.4" r="1.8" fill="#fff" />
        <circle className="arc-shine" cx="61" cy="44.4" r="1.8" fill="#fff" />
      </g>
    );
  }
  if (mood === "gaze") {
    // wide eyes turned up to the sky, with a high catch-light
    return (
      <g className="arc-eyes">
        <ellipse cx="41" cy="45" rx="5" ry="6.4" fill="#2a2410" />
        <ellipse cx="59" cy="45" rx="5" ry="6.4" fill="#2a2410" />
        <circle cx="42.6" cy="42" r="1.9" fill="#fff" />
        <circle cx="60.6" cy="42" r="1.9" fill="#fff" />
      </g>
    );
  }
  // open, tracking eyes (idle / paused / ponder)
  return (
    <g className="arc-eyes" ref={eyesRef}>
      <ellipse className="arc-eye" cx="41" cy="47" rx="5" ry="6.3" fill="#2a2410" />
      <ellipse className="arc-eye" cx="59" cy="47" rx="5" ry="6.3" fill="#2a2410" />
      <circle className="arc-shine" cx="43" cy="44.4" r="1.8" fill="#fff" />
      <circle className="arc-shine" cx="61" cy="44.4" r="1.8" fill="#fff" />
    </g>
  );
}
