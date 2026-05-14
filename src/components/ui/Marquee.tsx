import type { ReactNode } from 'react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
  /** Pixels per second */
  speed?: number;
  /** Reverse direction */
  reverse?: boolean;
  className?: string;
  /** Pause animation on hover */
  pauseOnHover?: boolean;
}

/**
 * Infinite horizontal marquee. Duplicates content twice so the loop is
 * seamless. Children are rendered as-is - wrap your items in flex/gap
 * inside the children.
 */
export default function Marquee({
  children,
  speed = 60,
  reverse = false,
  className = '',
  pauseOnHover = true,
}: Props) {
  // Distance the marquee travels is the children's own width.
  // We animate the inner track from 0 → -50% (since we duplicate).
  const duration = 2000 / Math.max(speed, 1);

  return (
    <div
      className={`overflow-hidden relative ${className}`}
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
    >
      <motion.div
        className="flex w-max"
        animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
        style={{ willChange: 'transform' }}
        whileHover={pauseOnHover ? { transitionEnd: { animationPlayState: 'paused' } } : undefined}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden="true">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
