import { AnimatePresence, motion } from "framer-motion";
import "./SpeechBubble.css";

export type BubbleTone = "quote" | "cheer" | "celebrate";

/**
 * A small speech bubble that floats above Arc, with a tail pointing down at it.
 * Purely presentational: pass `text` (or null/empty to hide) and a `tone`.
 * Decorative — marked aria-hidden; the timer keeps a screen-reader quote line.
 */
export function SpeechBubble({ text, tone = "quote" }: { text: string | null; tone?: BubbleTone }) {
  return (
    <div className="bubble-anchor" aria-hidden>
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={text}
            className={`bubble bubble-${tone}`}
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 4 }}
            transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {text}
            <span className="bubble-tail" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
