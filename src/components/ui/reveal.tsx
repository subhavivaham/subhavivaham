"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// same cubic bezier as the `slide-up` keyframe in globals.css, so JS-driven and
// CSS-driven motion on this site share one easing curve
const EASE = [0.16, 1, 0.3, 1] as const;

const GROUP: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
};

/**
 * Fades and lifts its children into place the first time they scroll into view.
 * Reduced motion renders the final state immediately rather than animating.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  amount = 0.3,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers its <RevealItem> children. Variants propagate down the tree, so the
 * items themselves carry no animation props — only the hidden/shown states.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  mode = "inView",
  amount = 0.1,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  /** "inView" reveals on scroll; "mount" plays once on first paint */
  mode?: "inView" | "mount";
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      variants={{ ...GROUP, show: { transition: { staggerChildren: stagger } } }}
      {...(mode === "mount"
        ? { animate: "show" as const }
        : { whileInView: "show" as const, viewport: { once: true, amount } })}
    >
      {children}
    </motion.div>
  );
}

/**
 * One cell of a <RevealGroup>. It renders a wrapper element, so when it is used
 * inside a CSS grid the grid item becomes the wrapper rather than the card —
 * pass `className="h-full"` here and `h-full` on the card itself to keep the
 * current stretched-card layout.
 */
export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={ITEM}>
      {children}
    </motion.div>
  );
}