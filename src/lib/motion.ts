import type { Variants, Transition } from 'motion/react';

/**
 * Shared motion language used across every section.
 * Keep additions here — never hard-code easings/durations in components.
 */

// ── Easings ─────────────────────────────────────────────────
export const easings = {
  outExpo: [0.2, 0.8, 0.2, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  inOutBack: [0.68, -0.55, 0.265, 1.55] as const,
};

// ── Springs ─────────────────────────────────────────────────
export const springs = {
  snappy: { type: 'spring', stiffness: 400, damping: 30, mass: 0.6 } satisfies Transition,
  soft: { type: 'spring', stiffness: 200, damping: 26, mass: 0.8 } satisfies Transition,
  bouncy: { type: 'spring', stiffness: 350, damping: 18, mass: 0.5 } satisfies Transition,
};

// ── Stagger config ──────────────────────────────────────────
export const stagger = {
  small: 0.04,
  default: 0.06,
  large: 0.1,
} as const;

// ── Reusable variants ───────────────────────────────────────
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easings.outExpo },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: easings.outExpo } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: easings.outExpo },
  },
};

export const staggerChildren = (delayChildren = 0, child = stagger.default): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: child, delayChildren },
  },
});

// ── Viewport defaults ───────────────────────────────────────
export const onceViewport = { once: true, amount: 0.2 } as const;
export const liveViewport = { once: false, amount: 0.4 } as const;

// ── Reduced-motion guard ────────────────────────────────────
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
