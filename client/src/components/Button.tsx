import { motion } from "framer-motion";
import type { ReactNode } from "react";
import "./Button.css";

type Variant = "solid" | "ghost" | "quiet";

export function Button({
  children,
  onClick,
  variant = "ghost",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.08, ease: "easeOut" }}
    >
      {children}
    </motion.button>
  );
}
